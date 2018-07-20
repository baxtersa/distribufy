import { SerializableRuntime } from './runtime/serializable';
import { Capture } from 'stopify-continuations/dist/src/runtime/runtime';

export function polyfillPromises(rts: SerializableRuntime): void {
  const originalThen = Promise.prototype.then;

  Promise.prototype.then = function <T1, T2>(resolve: (v: any) => T1 | PromiseLike<T1>,
    reject: (e: any) => T2 | PromiseLike<T2>): Promise<T1 | T2> {
    function wrapResolve(v: any) {
      console.log('thenning');
      return rts.rts.runtime(() => v, (doneV) => resolve(doneV.value));
    }

    function wrapReject(e: any) {
      if (e instanceof Capture) {
        return rts.rts.runtime(() => { throw e; },
          (v) => {
            if (v.type === 'normal') {
              return wrapResolve(v.value);
            } else {
              return reject(v.value);
            }
          });
      } else if (reject) {
        return reject(e);
      } else {
        throw e;
      }
    }

    return originalThen.call(this, wrapResolve, wrapReject)
  };
}
