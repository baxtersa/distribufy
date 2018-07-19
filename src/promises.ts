import { SerializableRuntime } from './runtime/serializable';
import { Capture } from 'stopify-continuations/dist/src/runtime/runtime';
import { KFrameRest } from 'stopify-continuations';

export function polyfillPromises(rts: SerializableRuntime): void {
  const originalThen = Promise.prototype.then;

  Promise.prototype.then = function<T1,T2> (resolve: (v: any) => T1 | PromiseLike<T1>,
    reject: (e: any) => T2 | PromiseLike<T2>): Promise<T1|T2> {
    return new Promise((r, rr) => {
      return rts.rts.runtime(() =>
        originalThen.call(this, function wrapResolve(v: any) {
          if (!rts.rts.mode) {
            const $frame = rts.rts.stack.pop() as KFrameRest;
            v = $frame.params[0];
          }

          try {
            return resolve(v);
          } catch (e) {
            if (e instanceof Capture) {
              e.stack.push({
                    kind: 'rest',
                    f: wrapResolve as any,
                    index: 0,
                    locals: [],
                    params: [v],
                    this: this,
              });

              return rts.processEvent(() => {
                throw e;
              }, () => {});
            }

            throw e;
          }
        }, reject),
        () => {});
    });
  };
}
