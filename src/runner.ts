import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { Depickler } from 'jsPickle';
import { Serialized, SerializableRuntime } from './runtime/serializable';

import * as $__T from 'stopify-continuations/dist/src/runtime/runtime';
const $__R = $__T.newRTS('catch');
import * as runtime from './runtime/node';
(<any>global).$__T = $__T;
(<any>global).$__R = $__R;
let $__D: SerializableRuntime;

function relativize(p: string): string {
  return path.join(process.cwd(), `/${p}`);
}

function parseArgs(args: string[]): yargs.Arguments {
  return parser.parse(args);
}

function runFromContinuation(args: yargs.Arguments): void {
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

function runFromStart() {
  if (!$__D) {
    $__D = runtime.init($__R);
    (<any>global).$__D = $__D;
  }
  return require(args.filename).call(global);
}

function run(args: yargs.Arguments) {
  if (args.continuation) {
    runFromContinuation(args);
  } else if (args.loop) {
    $__R.runtime(runFromStart, (result) => {
      run({ ...args, continuation: relativize('continuation.data') });
    });
  } else {
    $__R.runtime(runFromStart, (result) => {
      $__D.onEnd(result);
    });
  }
}

const parser = yargs.usage('Usage: $0 <filename> [options]')
  .strict()
  .command('$0 <filename>', 'Run the program with checkpointing', (yargs) =>
    yargs.positional('filename', {
      describe: 'Path to the source program to run',
      type: 'string',
      coerce: (opt => relativize(opt)),
    }).option({
      'c': {
        alias: 'continuation',
        describe: 'Resume execution with the serialized continuation',
        type: 'string',
        coerce: (opt => relativize(opt)),
      },
      'l': {
        alias: 'loop',
        describe: 'Run program to completion, resuming after each serialized suspension',
      },
      'p': {
        alias: 'parameter',
        describe: 'Parameter with which to resume suspended program',
      }
    }))
    .help()

const args = parseArgs(process.argv.slice(2));
run(args);
