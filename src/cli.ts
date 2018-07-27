import * as fs from 'fs';
import * as yargs from 'yargs';
import 'source-map-support/register';

import { RuntimeOptions, relativize, run } from './runner';

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
        coerce: (opt => fs.readFileSync(relativize(opt))),
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

function validate(args: yargs.Arguments): RuntimeOptions {
  return args as any;
}

export function parseArgs(args: string[]): RuntimeOptions {
  return validate(parser.parse(args));
}

const args: RuntimeOptions  = parseArgs(process.argv.slice(2));
run(args);