import * as yargs from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { Depickler } from 'jsPickle';

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
      }
    }))
    .help()

function parseArgs(args: string[]): yargs.Arguments {
  return parser.parse(args);
}

const args = parseArgs(process.argv.slice(2));
const main = require(args.filename);
if (args.continuation) {
  const buf = fs.readFileSync(args.continuation);
  const stack = depickle.deserialize(buf);
  stack[stack.length - 1].f = main;
  stack[stack.length - 1].this = this;
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
    if (result.type === 'exception') {
      throw result.value;
    }
    $__D.onEnd(result);
  });
} else {
  $__R.runtime(() => main(), (result) => {
    $__D.onEnd(result);
  });
}
