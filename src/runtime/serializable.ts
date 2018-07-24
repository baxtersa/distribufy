import { Capture, Restore, EndTurn } from 'stopify-continuations/dist/src/runtime/runtime';
import { Result, Runtime, Stack } from 'stopify-continuations';
import { ElapsedTimeEstimator } from 'stopify-estimators';
import * as fs from 'fs';
import { Pickler } from 'jsPickle';

export class Serialized {
  constructor(public continuation: string) {}
}

enum EventProcessingMode {
  Running,
  Paused,
  Waiting,
};

interface EventHandler {
  body: () => void;
  receiver: (x: Result) => void;
}

export class SerializableRuntime {
  private eventMode = EventProcessingMode.Running;
  private eventQueue: EventHandler[] = [];

  public onDone: (result: Result) => void;
  public onEnd: (result: any) => void;

  public persistent_map = new Map<string, any>();

  private pickle = new Pickler();
  private estimator: ElapsedTimeEstimator;

  constructor(public rts: Runtime) {
    function defaultDone(x: Result) {
      if (x.type === 'normal' && x.value instanceof Serialized) {
        return;
      } else if (x.type === 'exception') {
        throw x.value;
      }
    }

    this.rts = rts;
    this.onDone = defaultDone;
    this.onEnd = (result) => {
      this.eventMode = EventProcessingMode.Waiting;
      this.estimator.cancel();
      defaultDone(result);
      this.processQueuedEvents();
    };
  }

  setEstimator(estimator: ElapsedTimeEstimator): void {
    this.estimator = estimator;
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
//    return;
//    if (this.estimator.elapsedTime() === 0) {
//      return;
//    }

    return this.rts.captureCC(k => {
      return this.rts.endTurn((onDone) => {
        return this.rts.runtime(() => {
          try {
            this.estimator.reset();
            return k();
          } catch (exn) {
            exn.stack.shift();
            this.serialize(exn.stack);

            return new Serialized('continuation.data');
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

  /**
   * Support for suspensions in `async/await` programming model.
   *
   * Programs using `async/await` sequentially chain `Promise` resolutions,
   * i.e. there is no coordination between resolving multiple promises "in
   * parallel". Top-level calls to async functions return a Promise containing
   * either the resolved value or a stack capture exception in the case of a
   * suspended async function. Since this exception cannot escape the Promise,
   * top-level async function calls must be wrapped by the `promise` function
   * to asynchronously restore the continuation contained within the promise,
   * and continue the promise chain.
   */
  promise(p: Promise<any>): any {
    return p.then(v => {
      return this.rts.runtime(() => {
        if (v instanceof Capture ||
          v instanceof Restore ||
          v instanceof EndTurn) {
          throw v;
        } else {
          return v;
        }
      }, v => {
        if (v.type === 'normal' && v.value instanceof Promise) {
          return this.promise(v.value);
        } else {
          return v;
        }
      });
    });
  }

  processEvent(body: () => void, receiver: (x: Result) => void): void {
    this.eventQueue.push({ body, receiver } );
    this.processQueuedEvents();
  }

  private processQueuedEvents() {
    if (this.eventMode !== EventProcessingMode.Waiting) {
      return;
    }

    const eventHandler = this.eventQueue.shift();
    if (eventHandler === undefined) {
      return;
    }
    const { body, receiver } = eventHandler;
    this.eventMode = EventProcessingMode.Running;
    this.rts.runtime(body, (result) => {
      this.eventMode = EventProcessingMode.Waiting;
      receiver(result);
      this.processQueuedEvents();
    });
  }
};
