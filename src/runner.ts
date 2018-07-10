import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { Depickler } from 'jsPickle';
import { Serialized } from './runtime/serializable';

const depickle = new Depickler();

import * as $__T from 'stopify-continuations/dist/src/runtime/runtime';
const $__R = $__T.newRTS('catch');
import * as runtime from './runtime/node';
const $__D = runtime.init($__R);
(<any>global).$__T = $__T;
(<any>global).$__R = $__R;
(<any>global).$__D = $__D;

function relativize(p: string): string {
  return path.join(process.cwd(), `/${p}`);
}

function parseArgs(args: string[]): yargs.Arguments {
  return parser.parse(args);
}

function runFromContinuation(args: yargs.Arguments): void {
  const buf = fs.readFileSync(args.continuation);
  const stack = depickle.deserialize(buf);

  function restoreTopLevel() {
    delete require.cache[args.filename];
    stack[stack.length - 1].f = require(args.filename);
    stack[stack.length - 1].this = this;
  }

  restoreTopLevel();

  $__R.runtime(() => {
    throw new $__T.Capture((k) => {
      try {
        k()
      } catch (e) {
        if (e instanceof $__T.Restore) {
          (<any>e.stack[0]).this = $__D;
        }
        throw e;
      }
    }, stack);
  }, (result) => {
    if (result.type === 'exception' &&
      result.value instanceof Serialized &&
      args.loop) {
      run({ ...args, continuation: relativize('continuation.data') });
    } else {
      $__D.onEnd(result);
    }
  });
}

function run(args: yargs.Arguments) {
  if (args.continuation) {
    runFromContinuation(args);
  } else if (args.loop) {
    $__R.runtime(() => require(args.filename)(), (result) => {
      run({ ...args, continuation: relativize('continuation.data') });
    });
  } else {
    $__R.runtime(() => require(args.filename)(), (result) => {
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
      }
    }))
    .help()

const args = parseArgs(process.argv.slice(2));
run(args);
