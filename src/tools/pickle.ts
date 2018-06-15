import * as yargs from 'yargs';
import * as fs from 'fs';
import { Depickler, Pickler } from '../pickler'

process.stdout

yargs.command('deserialize <file>',
  'Deserialize the contents of the file into an object',
  (yargs) => {
    return yargs
      .positional('file', {
        describe: 'file to deserialize',
      });
  }, (argv: any) => {
    if (argv.verbose) {
      console.info(`deserializing file: ${argv.file}`);
    }
    const buffer = fs.readFileSync(argv.file);
    const depickle = new Depickler();
    console.log(`${depickle.deserialize(buffer)}`);
  })
  .command('serialize <json> <out>',
    'Serialize the json contents of the file `json` into an the file `out`',
    (yargs) => {
      return yargs
        .positional('json', {
          describe: 'File containing json object to serialize',
        })
        .positional('out', {
          describe: 'File to write output of serialization',
        });
    }, (argv: any) => {
      if (argv.verbose) {
        console.info(`serializing json from file: ${argv.json}`);
        console.info(`writing output to file: ${argv.out}`);
      }
      const json = fs.readFileSync(argv.json);
      const pickle = new Pickler();
      const buf = pickle.serialize(json);
      fs.writeFileSync(argv.out, buf);
    })
  .option('verbose', {
    alias: 'v',
    default: false,
  })
  .argv;

