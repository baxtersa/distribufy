import { Result, Runtime } from 'stopify-continuations/dist/src/types';
import { Stack } from 'stopify-continuations/dist/src/runtime/abstractRuntime';
import * as fs from 'fs';
import { Pickler } from 'jsPickle';

function defaultDone(x: Result) {
  if (x.type === 'exception') {
    throw x.value;
  }
}

export class SerializableRuntime {
  private pickle = new Pickler();

  constructor(private rts: Runtime,
    public onDone: (result: Result) => void = defaultDone,
    public onEnd: (result: any) => void = defaultDone) {
    this.rts = rts;
    this.onEnd = onEnd;
  }

  serialize(continuation: Stack): { continuationBuffer: Buffer } {
    const continuationBuffer = this.pickle.serialize(continuation);
    fs.writeFileSync('continuation.data', continuationBuffer);
    return { continuationBuffer };
  }

  checkpoint(): void {
    if (!this.rts.mode) {
      return this.rts.stack[0].f();
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
