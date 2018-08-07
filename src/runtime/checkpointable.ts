import { Capture, Restore, EndTurn } from 'stopify-continuations/dist/src/runtime/runtime';
import { Result, Runtime } from 'stopify-continuations';
import { Serializer } from '../utils/serializer';

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

function service(body: any, url: string): Promise<any> {
  console.log('service-req: ' + JSON.stringify(body));
  return needle('post', url + '/v1/jobs', body, { json: true })
    .then((response: any) =>
      response.statusCode >= 400 ? Promise.reject(response) : response);
}

function callback() {
  const slash = process.env.__OW_ACTION_NAME!.substring(1).indexOf('/') + 1
  const uri = process.env.__OW_API_HOST + '/api/v1/namespaces' + process.env.__OW_ACTION_NAME!.substring(0, slash) + '/actions' + process.env.__OW_ACTION_NAME!.substring(slash)
  return { type: 'http', uri: encodeURI(uri), auth: process.env.__OW_API_KEY }
}

/**kO
 * Frontend to continuations implementing serializable checkpoints.
 */
export class CheckpointRuntime extends Serializer {
  private eventMode = EventProcessingMode.Running;
  private eventQueue: EventHandler[] = [];

  public onDone: (result: Result) => void;
  public onEnd: (result: any) => void;

  constructor(public rts: Runtime) {
    super();
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
      defaultDone(result);
      this.processQueuedEvents();
      if (result.value instanceof Checkpoint) {
        return result.value.value;
      } else {
        return result.value;
      }
    };
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

  fork(count: number, serviceUrl: string, continuation: string): Promise<any> {
    console.log('fork checkpoint');
    const req = {
      action: 'fork',
      params: { count },
      callback: callback(),
      state: {
        $continuation: continuation,
      },
    };

    console.log('fork-req: ', JSON.stringify(req));

    return service(req, serviceUrl);
  }

  exec({
    action,
    args,
    payload,
    serviceUrl,
  }: { action: string, args: any, payload?: any, serviceUrl: string }): Promise<any> {
    return this.checkpoint(k => {
      const req = {
        action: action,
        callback: callback(),
        params: args,
        payload: payload || {},
        state: {
          $continuation: k,
        },
      };

      return service(req, serviceUrl)
        .then((response: any) =>
          ({ params: { method: 'exec', serviceId: response.body.id } }),
          (error: any) => {
            console.error(error); // exec failed
            return { params: { message: 'Internal Error' } };
          });
    });
  }

  join(args: any): Promise<any> {
    const join = args.join;
    const serviceUrl = args.serviceUrl;
    delete args.join;
    delete args.serviceUrl;

    return service({
      action: 'join',
      params: join,
      payload: args,
    }, serviceUrl)
      .then((response: any) =>
        ({ params: { method: 'join', serviceId: response.body.id } }),
        (error: any) => {
          console.error(error);
          return { params: { error: `Internal Error` } };
        });
  }

  resume(buffer: Buffer, entrypoint: () => (() => any)): void {
    for (const mod in require.cache) {
      delete require.cache[mod];
    }
    const main = entrypoint();

    const continuation = this.deserialize(buffer);
    this.rts.stack = continuation;

    if (this.rts.stack[this.rts.stack.length - 1].f.name === main.name) {
      this.rts.stack[this.rts.stack.length - 1].f = main;
    }
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
