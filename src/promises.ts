import { Serialized, SerializableRuntime } from './runtime/serializable';
import { Capture } from 'stopify-continuations/dist/src/runtime/runtime';

export function polyfillPromises(rts: SerializableRuntime): void {
  const originalThen = Promise.prototype.then;

  Promise.prototype.then = function <T1, T2>(resolve: (v: any) => T1 | PromiseLike<T1>,
    reject: (e: any) => T2 | PromiseLike<T2>): Promise<T1 | T2> {
    function wrapResolve(v: any) {
      if (v instanceof Serialized) {
        return v;
      }

      console.log('thenning');
      return rts.rts.runtime(() => v, (doneV) => {
        if (doneV instanceof Serialized) {
          return;
        }
        return resolve(doneV.value);
      });
    }

    function wrapReject(e: any) {
      if (e instanceof Capture) {
        return rts.rts.runtime(() => { throw e; },
          (v) => {
            if (v.type === 'normal' && v.value instanceof Serialized) {
              return v.value;
            } else if (v.type === 'normal') {
              return wrapResolve(v.value);
            } else if (v.type === 'exception' && v.value instanceof Serialized) {
              throw v.value;
            } else {
              return reject(v.value);
            }
          });
      } if (reject) {
        return reject(e);
      } else {
        throw e;
      }
    }

    return originalThen.call(this, wrapResolve, wrapReject);
  };
}
