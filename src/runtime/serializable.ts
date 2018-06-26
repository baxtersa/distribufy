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

  serialize(continuation: Stack): { continuationBuffer: Buffer, runtimeBuffer: Buffer } {
    const continuationBuffer = this.pickle.serialize(continuation);
    const runtimeBuffer = this.pickle.serialize(this);
    console.log('writing', continuationBuffer);
    fs.writeFileSync('continuation.data', continuationBuffer);
    fs.writeFileSync('runtime.data', runtimeBuffer);
    return { continuationBuffer, runtimeBuffer };
  }

  checkpoint(): void {
    return this.rts.captureCC(k => {
      return this.rts.endTurn((onDone) => {
        return this.rts.runtime(() => {
          try {
            k();
          } catch (exn) {
//            const { continuationBuffer } = this.serialize(exn);
//            const newStack = this.depickle.deserialize(continuationBuffer);
//            exn.stack = newStack;
            throw exn;
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
