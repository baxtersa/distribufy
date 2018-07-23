import { Serialized, SerializableRuntime } from './runtime/serializable';
import { Capture } from 'stopify-continuations/dist/src/runtime/runtime';

const handlers = Symbol.for('handlers');

export function polyfillPromises(rts: SerializableRuntime): void {

  const originalThen = Promise.prototype.then;
  Promise.prototype.then =
    function <T1, T2>(onFulfilled: (v: any) => T1 | PromiseLike<T1>,
      onRejected: (e: any) => T2 | PromiseLike<T2>): Promise<T1 | T2> {
      // Reify handlers queued on Promise object for serialization
      this[handlers] = this[handlers] || [];
      this[handlers].push({ onFulfilled, onRejected });

      const wrapFulfill = (v: any) => {
        // A Promise chain has already been suspended. Early-exit chained
        // callbacks.
        if (v instanceof Serialized) {
          return v;
        }

        console.log('thenning', v);
        // Wrap `onFulfilled` callback in runtime trampoline to handle
        // suspending inside Promise callbacks.
        return rts.rts.runtime(() => onFulfilled(v), (result) => {
          // Release resolved handler
          this[handlers].unshift();
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
              if (v.type === 'normal' && v.value instanceof Serialized) {
                // If we are serializing, just propogate the special return
                // value.
                return v.value;
              } else if (v.type === 'normal') {
                // If the resumption completes successfully, fulfill the
                // promise.
                const r = wrapFulfill(v.value);
                this[handlers].unshift();
                return r;
              } else {
                // If the resumption fails, reject the promise.
                const r = onRejected(v.value);
                this[handlers].unshift();
                return r;
              }
            });
        } else if (onRejected) {
          // A user exception was thrown, so forward to the `onRejected`
          // function if it exists.
          const r = onRejected(e);
          this[handlers].unshift();
          return r;
        } else {
          // An unhandled user expception was thrown, propogate the throw.
          throw e;
        }
      }

      // Invoke the original `then` callback with wrapped handlers.
      const thenned = originalThen.call(this, wrapFulfill, wrapReject);
      // Reify the happens-before relation of the Promise chain.
      this.resolvesTo = thenned;
      return thenned;
    };
}
