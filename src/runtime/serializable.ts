import { Result, Runtime } from 'stopify-continuations/dist/src/types';
import { Stack } from 'stopify-continuations/dist/src/runtime/abstractRuntime';
import * as fs from 'fs';
import { Pickler, Depickler } from 'jsPickle';

function defaultDone(x: Result) {
  if (x.type === 'exception') {
    throw x.value;
  }
}

export class SerializableRuntime {
  private rts: Runtime;
//  private onDone: (result: Result) => void;
  private onEnd: (result: any) => void;

  private pickle = new Pickler();
  private depickle = new Depickler();

  constructor(rts: Runtime, onDone: (result: Result) => void = defaultDone,
    onEnd: (result: any) => void = defaultDone) {
    this.rts = rts;
    this.onEnd = onEnd;
  }

  serialize(continuation: Stack): { continuationBuffer: Buffer } {
    const continuationBuffer = this.pickle.serialize(continuation);
    console.log('writing', continuationBuffer);
    fs.writeFileSync('continuation.data', continuationBuffer);
    return { continuationBuffer };
  }

  checkpoint(): void {
    return this.rts.captureCC(k => {
      return this.rts.endTurn((onDone) => {
        return this.rts.runtime(() => {
          try {
            k();
          } catch (exn) {
            const frame = exn.stack.shift();
            const { continuationBuffer } = this.serialize(exn.stack);
//            const newStack = this.depickle.deserialize(continuationBuffer);
//            exn.stack = newStack;
//            exn.stack.unshift(frame);
//            throw exn;
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
