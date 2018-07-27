import { Capture, Restore, EndTurn } from 'stopify-continuations/dist/src/runtime/runtime';
import { Result, Runtime, Stack } from 'stopify-continuations';
import { ElapsedTimeEstimator } from 'stopify-estimators';
import * as fs from 'fs';
import { Pickler } from '../serialization/pickler';
const needle = require('needle');

/**
 * Wrapped value returned from checkpoint handlers.
 */
export class Checkpoint {
  constructor(public value: any) {}
}

// Event Support

enum EventProcessingMode {
  Running,
  Paused,
  Waiting,
};

interface EventHandler {
  body: () => void;
  receiver: (x: Result) => void;
}

// Promise Support

export type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';
export type PromiseHandler<T1,T2> = {
  onFulfilled: (v: any) => T1 | PromiseLike<T1>,
  onRejected: (e: any) => T2 | PromiseLike<T2>,
};

export interface ReifiedPromise<T> {
  status: PromiseStatus;
  value?: T;
  handlers: PromiseHandler<any,any>[];
  resolvesTo?: Promise<any>;
};

/**
 * Frontend to continuations implementing serializable checkpoints.
 */
export class SerializableRuntime {
  private eventMode = EventProcessingMode.Running;
  private eventQueue: EventHandler[] = [];

  public onDone: (result: Result) => void;
  public onEnd: (result: any) => void;

  private pickle = new Pickler();
  private estimator: ElapsedTimeEstimator;

  /**
   * Maps identifiers to values to be persisted for initialization code re-run
   * when restoring checkpoints.
   */
  public persistent_map = new Map<string, any>();
  /** Maps `Promise` references to reified promise state for serialization. */
  public promises = new Map<Promise<any>, ReifiedPromise<any>>();

  constructor(public rts: Runtime) {
    function defaultDone(x: Result) {
      if (x.type === 'normal' && x.value instanceof Checkpoint) {
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
      if (result.value instanceof Checkpoint) {
        return result.value.value;
      } else {
        return result.value;
      }
    };
  }

  setEstimator(estimator: ElapsedTimeEstimator): void {
    this.estimator = estimator;
  }

  /**
   * Utility function to persist non-deterministic initialization code that
   * gets rerun across checkpoints.
   *
   * @param id - Identifier storing persisted value in serialized Map
   * @param e  - Thunk which evaluates to the value to be persisted
   */
  persist<T>(id: string, e: () => T): T {
    let v = this.persistent_map.get(id);
    if (v === undefined) {
      v = e();
      this.persistent_map.set(id, v);
    }
    return v;
  }

  private serialize(continuation: Stack): Buffer {
    const o = {
      continuation,
      persist: this.persistent_map,
      promises: this.promises,
    };
    const continuationBuffer = this.pickle.serialize(o);
    fs.writeFileSync('continuation.data', continuationBuffer);
    return continuationBuffer;
  }

  /**
   * Primitive to build extensible functionality handling continuations and
   * checkpointing.
   *
   * @param fn - called with the base64-encoded continuation
   */
  checkpoint(fn: (k: string) => any = k => k): any {
    return this.rts.captureCC(k =>
      this.rts.endTurn(onDone =>
        this.rts.runtime(() => {
          try {
            return k();
          } catch (exn) {
            exn.stack.shift();
            const buffer = this.serialize(exn.stack);

            const result = fn(buffer.toString('base64'));
            return new Checkpoint(result);
          }
        }, onDone)));
  }

  invoke(action: string, params: any): any {
    return this.checkpoint($continuation =>
      ({ action, params, state: { $continuation: $continuation } }));
  }

  http(uri: string) {
    // Capture the continuation at the http callsite.
    return this.rts.captureCC(k =>
      this.rts.endTurn(onDone =>
        this.rts.runtime(() => {
          try {
            return k()
          } catch (exn) {
            // Intercept the continuation restoration to serialize it to disk.
            const frame = exn.stack.shift();
            this.serialize(exn.stack);
            exn.stack.unshift(frame);

            // This is where we have to implement the continuation service
            // integration. We should delegate to sherpa to perform the http
            // request, passing the serialized continuation along with other
            // arguments. Sherpa should resume the serialized continuation,
            // passing the result of the http request as an additional
            // parameter, which gets injected into the continuation after
            // deserialization.

            // Invoke http request
            return needle('get', uri, { json: true })
              .then((response: any) =>
                this.rts.runtime(() =>
                  k(response), onDone));
          }
        }, () => {})));
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

  /**
   * Adds a function to internal event queue. Used to make Distribufy aware of
   * asynchronous events like `setTimeout`.
   *
   * @param body     - function pushed to internal event queue
   * @param receiver - function to handle result of `body`. Called when `body`
   *                   terminates
   */
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
