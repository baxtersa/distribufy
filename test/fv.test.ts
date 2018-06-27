import * as assert from 'assert';
const glob = require('glob');
import * as fs from 'fs';
import * as tmp from 'tmp';
import { spawnSync } from 'child_process';

async function resolve(stream: fs.WriteStream, fn: () => void): Promise<void> {
  return new Promise<void>((accept, reject) => {
    stream.on('open', () => {
      try {
        fn();
        return accept();
      } catch (exn) {
        return reject(exn);
      }
    });
  });
}

describe("testing serialization process", () => {
  const files = glob.sync("./test/src/*.js", {});
  for (const src of files) {
    test(`${src}`, async () => {
      const { name: dst } = tmp.fileSync({ dir: '.', postfix: '.js' });
      const outStream = fs.createWriteStream(dst);
      return await resolve(outStream, function () {
        try {
          assert.equal(spawnSync('node',
            [
              '-r',
              'source-map-support/register',
              './dist/src/transform/scope.js',
              src, '>', dst
            ],
            { stdio: [ process.stdin, outStream, process.stderr ] }).status,
            0,
            'error during compilation');
          assert(spawnSync('node', [ dst ], { stdio: 'inherit' }).status === 0,
            'error while running');
        } finally {
          fs.unlinkSync(dst);
        }
      });
    });
  }
});
