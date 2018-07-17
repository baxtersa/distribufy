import { Result, Runtime, Stack } from 'stopify-continuations';
import { ElapsedTimeEstimator } from 'stopify-estimators';
import * as fs from 'fs';
import { Pickler } from 'jsPickle';

export class Serialized {
  constructor(public continuation: string) {}
}

export class SerializableRuntime {
  public onDone: (result: Result) => void;
  public onEnd: (result: any) => void;

  public persistent_map = new Map<string, any>();

  private pickle = new Pickler();

  constructor(private rts: Runtime,
    private estimator: ElapsedTimeEstimator) {
    function defaultDone(x: Result) {
      if (x.type === 'exception' && x.value instanceof Serialized) {
        return;
      } else if (x.type === 'exception') {
        throw x.value;
      }
    }

    this.rts = rts;
    this.onDone = defaultDone;
    this.onEnd = (result) => {
      this.estimator.cancel();
      defaultDone(result);
    };
  }

  persist<T>(id: string, e: () => T): T {
    let v = this.persistent_map.get(id);
    if (v === undefined) {
      v = e();
      this.persistent_map.set(id, v);
    }
    return v;
  }

  serialize(continuation: Stack): { continuationBuffer: Buffer } {
    const o = {
      continuation,
      persist: this.persistent_map,
    };
    const continuationBuffer = this.pickle.serialize(o);
    fs.writeFileSync('continuation.data', continuationBuffer);
    return { continuationBuffer };
  }

  checkpoint(): void {
    if (this.estimator.elapsedTime() === 0) {
      return;
    }

    return this.rts.captureCC(k => {
      return this.rts.endTurn((onDone) => {
        return this.rts.runtime(() => {
          try {
            this.estimator.reset();
            k();
          } catch (exn) {
            exn.stack.shift();
            this.serialize(exn.stack);

            throw new Serialized('continuation.data');
          }
        }, onDone);
      });
    });
  }

  resume(): void {

  }

  sleep(ms: number): void {
    return this.rts.captureCC(k => {
      return this.rts.endTurn((onDone) => {
        return setTimeout(() => {
          this.rts.runtime(k, onDone);
        }, ms);
      });
    });
  }
};
