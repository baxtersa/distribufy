# Distribufy

Distribufy is an extension to
[Stopify](https://github.com/plasma-umass/Stopify) implementing serializable
continuations. Distribufy levarages serializable continuations to build a
synchronous programming model for asynchronous I/O on the serverless
[OpenWhisk](https://openwhisk.apache.org) platform.

Distribufy exposes a `checkpoint` function to JavaScript programs, which
captures and serializes a program's continuation. Checkpoints provide the
basis for more complex compositions of I/O driven programs.

## Building

Distribufy builds against a branch of Stopify which must be built from
source. The following steps should get your environment up and running.

- First, clone and build Stopify locally.
```bash
$ git clone https://github.com/plasma-umass/Stopify.git --branch distribufy stopify
$ cd stopify
$ yarn install && yarn build
```

- Now clone Distribufy alongside the local Stopify repository and build
Distribufy.
```bash
$ git clone https://github.com/baxtersa/distribufy.git
$ cd <distribufy-root>
$ yarn install && yarn build
```

**Note:** The repositories must be cloned next to eachother in the filesystem.

**Optional:** The steps to clone and build `distribufy` result in large `zip`
files for uploaded cloud function packages because development dependencies
are also zipped up in `node_modules`. To reduce the size of the `zip`
bundles, follow these instructions instead.
```bash
$ git clone https://github.com/baxtersa/distribufy.git
$ cd <distribufy-root>
$ yarn install --production
$ # Prime a zip file with just the production dependencies
$ zip -r <primed-action>.zip node_modules
$ yarn install && yarn build
$ zip -r <primed-action>.zip dist
```

Now `<primed-action>.zip` is primed with only production dependencies, resulting in a
much smaller `zip` to upload.

## Usage

Distribufy consists of a command-line compiler and command-line launcher.

### `bin/distribufy`

The `bin/distribufy` command compiles programs and instruments them to
support capturing continuations. The default invocation from the command line
is:
```bash
$ bin/distribufy <src> <dst> --func -t catch
```

These command line flags require brief explanation.

 - `--func` tells the compiler not to wrap the source file in a top-level
 function. Without this option, extra insrumentation is injected to generate
 a standalone, runnable output file. Distribufy relies on programs being
 wrapped by its launcher to run.

 - `-t catch` tells the compiler which instrumentation method to use to
 capture continuations. This strategy has shown the best performance on some
 benchmarks.

### Cloud Deployment

Compiled programs can be deployed and run on OpenWhisk. This currently
requires building cloud functions in-tree and structuring the deployed `.zip`
action a certain way. The following commands show how to compile, deploy, and
invoke checkpointing functions.

First, compile the source program into `<distribufy-root>/dist/`.
```bash
$ cd <distribufy-root>
$ bin/distribufy <src> dist/tmp.js --func -t catch
```

Next, create the `.zip` archive to be deployed.
```bash
$ # Define the entrypoint of the cloud function in `package.json`.
$ mkdir tmp && echo '{ "main": "./dist/src/cloud.js" }' > tmp/package.json
$ zip -r <action>.zip node_modules dist
$ zip -j <action>.zip tmp/package.json
```

**Optional:** If the optional steps to produce a primed, smaller `zip` file were taken above, follow these steps to create the `zip` archive instead.
```bash
$ # Define the entrypoint of the cloud function in `package.json`.
$ mkdir tmp && echo '{ "main": "./dist/src/cloud.js" }' > tmp/package.json
$ zip <primed-action>.zip dist/tmp.js
$ zip -j <primed-action>.zip tmp/package.json
```

Now, deploy the function to openwhisk with the annotation `--annotation
conductor true`.
```bash
$ wsk action create <action> <action>.zip --kind nodejs:8 --annotation conductor true
```

Finally, the action can be invoked normally, optionally passing parameters to
the function.
```bash
$ wsk action invoke <action> ...[-p key value] --result
```

### `bin/run-dist`

The `bin/run-dist` command wraps compiled programs so that they can be run
from the command line under three different modes: 1) from the start, 2) from
a serialized checkpoint, and 3) end-to-end (1 & 2 run programs only to the
next checkpoint).

#### Running from the start

The following command runs a program from the start of its entrypoint.

```bash
$ bin/run-dist <program>
```

If the program reaches a checkpoint, a continuation will be serialized to the
file `continuation.data` on disk.

#### Running from a serialized checkpoint

The following command restores a serialized checkpoint, and resumes a
program's execution from that position.

```bash
$ bin/run-dist <program> --continuation <continuation-file>
```

Again, if the program reaches a checkpoint, a continuation will be serialized
to the file `continuation.data` on disk.

#### Running end-to-end

If you want to run a program end-to-end, resuming each checkpoint
automatically, you can run the following command.

```bash
$ bin/run-dist <program> --loop
```

## Assumptions

There are some limitations on the types of programs currently supported by Distribufy. These are listed and discussed briefly.

- Files should have a single function entrypoint declared with
`module.exports = <function>`.

- Top-level statements should be restricted to `require` statements,
declarations of functions, values, and non-checkpointing paths of execution.

- Full `Promise` support is not yet implemented. Certain patterns of
interleaving `Promise`s with checkpoints may work, but have not been fully
developed or tested.

- Library calls should not be reentrant. Callback-driven and higher-order
APIs are not currently supported.

## Examples

### Simple Sleeping Checkpointing

This program prints a line before and after a 5s sleep, demonstrating that
sequential code is properly checkpointed and not re-executed upon resumption.

```js
const runtime = require('./src/index');
const utils = runtime.require('./src/utils/utils')
  .register(runtime, '<external-service-url>');

function main() {
  console.log('before sleep');
  utils.sleep(5000);
  console.log('after sleep');
}

module.exports = main;
```

### Nondeterministic Top-level Declarations

Nondeterministic top-level program statements can be persisted
across checkpoints. Without calling `persist`, each log would print a
unique timestamp.

```js
const runtime = require('./src/index');

let timestamp = runtime.persist('i', () => Date.now());

function checkpointThenTimestamp() {
  runtime.checkpoint();
  return timestamp;
}

function main() {
  console.log(checkpointThenTimestamp());
  console.log(checkpointThenTimestamp());
  console.log(checkpointThenTimestamp());
}

module.exports = main;
```

### Closures and Free Variables

This program demonstrates support for checkpointing within nested closures
which mutate captured state. The top-level `require('assert')` is also closed over by the function `main`.

```js
const runtime = require('./src/index');
const assert = require('assert');

function main() {
  let x = 0;
  let y = 1;
  let z = 2;

  function foo() {
    runtime.checkpoint();
    x++;
    function bar() {
      runtime.checkpoint();
      y++;
      function baz() {
        runtime.checkpoint();
        z++;
        return x+y+z;
      }
      return { baz };
    }
    return { bar };
  }

  const o1 = foo();     // increments x (0->1), returns bar
  const o2 = o1.bar();  // increments y (1->2), returns baz
  const a = o2.baz();   // increments z (2->3), returns x+y+z = 1+2+3
  foo();                // increments x (1->2)

  assert.equal(a, 6);
  assert.equal(x, 2);
  assert.equal(y, 2);
  assert.equal(z, 3);
}

module.exports = main;
```

### Checkpointing I/O

The `checkpoint.js` program demonstrates checkpointing at an I/O boundary
before making an asynchronous request, and restoring with the I/O result from
the serialized checkpoint. This assumes the `http.js` function has been
deployed in the same namespace.

`http.js` - makes a HTTP request and returns the response body.

```js
const needle = require('needle');

function main(params) {
  const { method, uri } = params;

  return needle(method, uri, { json: true })
    .then(response => response.body);
}
```

`checkpoint.js` - creates local state, checkpoints and invokes 'http.js', and
returns a combination of the restored local state and HTTP response.

```js
const runtime = require('./src/index');

function main() {
  const options = {
    method: 'GET',
    uri: 'api.open-notify.org/iss-now.json',
  };

/**
 * response: {
 *   iss_position: {
 *     latitude: string,
 *     longitude: string,
 *   },
 *   message: string,
 *   timestamp: number,
 * }
 */
  const response = runtime.invoke('http', options);

  return {
    input: options,
    output: response,
  };
}

module.exports = main;
```