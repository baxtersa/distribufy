import * as fs from 'fs';
import * as path from 'path';
import { Depickler } from './serialization/pickler';
import { Serialized, SerializableRuntime } from './runtime/serializable';

export interface RuntimeOptions {
  filename: string;
  continuation: string | Buffer;
  loop: boolean;
  parameter: any;
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

function runFromContinuation(args: RuntimeOptions): void {
  const buf = fs.readFileSync(args.continuation);

  $__R.runtime(() => {
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
        k(args.parameter)
      } catch (e) {
        if (e instanceof $__T.Restore) {
          e.stack[0].this = $__D;
        }
        throw e;
      }
    }, $__D.rts.stack);
  }, (result) => {
    if (result.type === 'normal' &&
      result.value instanceof Serialized &&
      args.loop) {
      run({ ...args, continuation: relativize('continuation.data') });
    } else {
      $__D.onEnd(result);
    }
  });
}

function runFromStart(args: RuntimeOptions) {
  if (!$__D) {
    $__D = runtime.init($__R);
    (<any>global).$__D = $__D;
  }
  return require(args.filename).call(global);
}

export function run(args: RuntimeOptions) {
  if (args.continuation) {
    runFromContinuation(args);
  } else if (args.loop) {
    $__R.runtime(() => runFromStart(args), (result) => {
      run({ ...args, continuation: relativize('continuation.data') });
    });
  } else {
    $__R.runtime(() => runFromStart(args), (result) => {
      $__D.onEnd(result);
    });
  }
}
