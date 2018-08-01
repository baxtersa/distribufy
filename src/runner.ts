import * as path from 'path';
import { CheckpointRuntime } from './runtime/checkpointable';
//import { polyfillPromises, unpolyfillPromises } from './promises';

export interface RuntimeOptions {
  filename?: string;
  continuation?: string | Buffer;
  parameter?: any;
}

import * as $__T from 'stopify-continuations/dist/src/runtime/runtime';
const $__R = $__T.newRTS('catch');
import * as runtime from './runtime/node';
(<any>global).$__T = $__T;
(<any>global).$__R = $__R;
let $__D: CheckpointRuntime;

export function relativize(p: string): string {
  return path.join(process.cwd(), `/${p}`);
}

function runFromContinuation(filename: string, continuation: string, args: RuntimeOptions): any {
  const buf = new Buffer(continuation, 'base64');

  return $__R.runtime(() => {
    if (!$__D) {
      $__D = runtime.init($__R);
      (<any>global).$__D = $__D;
      //polyfillPromises($__D);
    }

    $__D.resume(buf, () => require(filename));

    throw new $__T.Capture((k) => {
      try {
        return k(args.parameter)
      } catch (e) {
        if (e instanceof $__T.Restore) {
          e.stack[0].this = $__D;
        }
        throw e;
      }
    }, $__D.rts.stack);
  }, result => $__D.onEnd(result));
}

function runFromStart(filename: string, args: RuntimeOptions): any {
  if (!$__D) {
    $__D = runtime.init($__R);
    (<any>global).$__D = $__D;
    //polyfillPromises($__D);
  }

  for (const mod in require.cache) {
    delete require.cache[mod];
  }
  return require(filename).call(global, args.parameter || {});
}

export function run(args: RuntimeOptions): any {
  const filename = args.filename || '../tmp.js';
  delete args.filename;

  const continuation = args.continuation;
  delete args.continuation;

  if (continuation) {
    return runFromContinuation(filename, continuation as string, args);
  } else {
    return $__R.runtime(() => runFromStart(filename, args),
      result => {
        const final = $__D.onEnd(result);
        //unpolyfillPromises();
        return final;
      });
  }
}

export function join(args: any): any {
  if (!$__D) {
    $__D = runtime.init($__R);
    (<any>global).$__D = $__D;
  }

  return $__D.join(args);
}