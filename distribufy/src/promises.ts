import { Checkpoint, CheckpointRuntime } from './runtime/checkpointable';
import { Capture } from 'stopify-continuations';

const originalResolve = Promise.resolve;
const originalThen = Promise.prototype.then;

export function unpolyfillPromises(): void {
  Promise.prototype.then = function (onFulfilled, onRejected) {
    return originalThen.call(this, onFulfilled, onRejected);
  };

  (<any>Promise.resolve) = function <T>(v: T | PromiseLike<T>): Promise<T> {
    return originalResolve.call(this, v);
  };
}

export function polyfillPromises(rts: CheckpointRuntime): void {
  (<any>Promise.resolve) = function <T>(v: T | PromiseLike<T>): Promise<T> {
    // Reify resolved value as queued promise in runtime.
    const p = originalResolve.call(this, v);
    rts.promises.set(p, {
      status: 'fulfilled',
      value: v,
      handlers: [],
    });
    return p;
  }

  Promise.prototype.then =
    function <T1, T2>(onFulfilled: (v: any) => T1 | PromiseLike<T1>,
      onRejected: (e: any) => T2 | PromiseLike<T2>): Promise<T1 | T2> {
      // Reify handlers queued on Promise object for serialization
      let reifiedPromise: any = rts.promises.get(this);
      if (!reifiedPromise) {
        reifiedPromise = {
          status: 'pending',
          value: undefined,
          handlers: [{ onFulfilled, onRejected }],
        };
        rts.promises.set(this, reifiedPromise)
        //throw new Error(`Promise not registered with runtime`);
      }
      reifiedPromise.handlers.push({ onFulfilled, onRejected });

      const wrapFulfill = (v: any) => {
        // A Promise chain has already been suspended. Early-exit chained
        // callbacks.
        if (v instanceof Checkpoint) {
          return v;
        }

        // Wrap `onFulfilled` callback in runtime trampoline to handle
        // suspending inside Promise callbacks.
        return rts.rts.runtime(() => onFulfilled(v), (result) => {
          if (result.value instanceof Checkpoint) {
            return result.value;
          }

          // Release resolved handler
          reifiedPromise.handlers.unshift();
          reifiedPromise.status = 'fulfilled';
          reifiedPromise.value = result.value;
          return result.value;
        });
      }

      const wrapReject = (e: any) => {
        // A Promise was rejected by initiating the capture of a continuation.
        if (e instanceof Capture) {
          // Rethrow the capture exception in a nested runtime to handle the
          // exception.
          return rts.rts.runtime(() => { throw e; },
            (v) => {
              if (v.type === 'normal' && v.value instanceof Checkpoint) {
                // If we are serializing, just propogate the special return
                // value.
                return v.value;
              } else if (v.type === 'normal') {
                // If the resumption completes successfully, fulfill the
                // promise.
                const r = wrapFulfill(v.value);
                reifiedPromise.handlers.unshift();
                reifiedPromise.status = 'fulfilled';
                reifiedPromise.value = v.value;
                return r;
              } else {
                // If the resumption fails, reject the promise.
                const r = onRejected(v.value);
                reifiedPromise.handlers.unshift();
                reifiedPromise.status = 'rejected';
                reifiedPromise.value = v.value;
                return r;
              }
            });
        } else if (onRejected) {
          // A user exception was thrown, so forward to the `onRejected`
          // function if it exists.
          const r = onRejected(e);
          reifiedPromise.handlers.unshift();
          reifiedPromise.status = 'rejected';
          reifiedPromise.value = r;
          return r;
        } else {
          // An unhandled user expception was thrown, propogate the throw.
          reifiedPromise.handlers.unshift();
          reifiedPromise.status = 'rejected';
          reifiedPromise.value = e;
          throw e;
        }
      }

      // Invoke the original `then` callback with wrapped handlers.
      const thenned = originalThen.call(this, wrapFulfill, wrapReject);
      rts.promises.set(thenned, {
        status: 'pending',
        handlers: [],
      });
      // Reify the happens-before relation of the Promise chain.
      reifiedPromise.resolvesTo = thenned;
      return thenned;
    };
}
