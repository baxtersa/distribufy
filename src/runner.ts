import * as path from 'path';
import { Depickler } from './serialization/pickler';
import { Checkpoint, SerializableRuntime } from './runtime/serializable';
import { polyfillPromises, unpolyfillPromises } from './promises';

export interface RuntimeOptions {
  filename: string;
  continuation?: string | Buffer;
  loop?: boolean;
  parameter?: any;
}

import * as $__T from 'stopify-continuations/dist/src/runtime/runtime';
const $__R = $__T.newRTS('catch');
import * as runtime from './runtime/node';
(<any>global).$__T = $__T;
(<any>global).$__R = $__R;
let $__D: SerializableRuntime;

export function relativize(p: string): string {
  return path.join(process.cwd(), `/${p}`);
}

function runFromContinuation(args: RuntimeOptions): any {
  const buf = new Buffer(args.continuation as string, 'base64');

  return $__R.runtime(() => {
    if (!$__D) {
      $__D = runtime.init($__R, buf);
      (<any>global).$__D = $__D;
      const main = require(args.filename);
      if ($__D.rts.stack[$__D.rts.stack.length - 1].f.name === main.name) {
        $__D.rts.stack[$__D.rts.stack.length - 1].f = main;
      }
    } else if (buf) {
      const depickle = new Depickler();

      const { continuation, persist } = depickle.deserialize(buf);
      $__D.persistent_map = persist;
      $__D.rts.stack = continuation;
      delete require.cache[args.filename];
      const main = require(args.filename);
      if ($__D.rts.stack[$__D.rts.stack.length - 1].f.name === main.name) {
        $__D.rts.stack[$__D.rts.stack.length - 1].f = main;
      }
    }

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
  }, result => {
    if (result.type === 'normal' &&
      result.value instanceof Checkpoint &&
      args.loop) {
      return run({ ...args, continuation: relativize('continuation.data') });
    } else {
      return $__D.onEnd(result);
    }
  });
}

function runFromStart(args: RuntimeOptions): any {
  if (!$__D) {
    $__D = runtime.init($__R);
    (<any>global).$__D = $__D;
  }
  polyfillPromises($__D);
  return require(args.filename).call(global);
}

export function run(args: RuntimeOptions): any {
  if (args.continuation) {
    return runFromContinuation(args);
  } else if (args.loop) {
    return $__R.runtime(() => runFromStart(args),
      result => run({ ...args, continuation: relativize('continuation.data') }));
  } else {
    return $__R.runtime(() => runFromStart(args),
      result => {
        const final = $__D.onEnd(result);
        unpolyfillPromises();
        return final;
      });
  }
}
