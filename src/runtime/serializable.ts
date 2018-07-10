import { Result, Runtime, Stack } from 'stopify-continuations';
import { ElapsedTimeEstimator } from 'stopify-estimators';
import * as fs from 'fs';
import { Pickler } from 'jsPickle';

export class SerializableRuntime {
  public onDone: (result: Result) => void;
  public onEnd: (result: any) => void;

  private pickle = new Pickler();

  constructor(private rts: Runtime,
    private estimator: ElapsedTimeEstimator) {
    function defaultDone(x: Result) {
      if (x.type === 'exception') {
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

  serialize(continuation: Stack): { continuationBuffer: Buffer } {
    const continuationBuffer = this.pickle.serialize(continuation);
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
            k();
          } catch (exn) {
            exn.stack.shift();
            this.serialize(exn.stack);
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
