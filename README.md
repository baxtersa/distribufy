# Distribufy

Distribufy is an extension to
[Stopify](https://github.com/plasma-umass/Stopify) implementing serializable
continuations. Distribufy levarages serializable continuations to build a
synchronous programming model for asynchronous I/O on the serverless
[OpenWhisk](https://openwhisk.apache.org) platform.

Distribufy exposes a `checkpoint` function to JavaScript programs, which
captures and serializes a program's continuation. Checkpoints provide the
basis for more complex compositions of I/O driven programs.

## Developing

Clone and build Distribufy locally if you are planning on developing
Distribufy itself.
```bash
$ git clone https://github.com/baxtersa/distribufy.git
$ cd <distribufy-root>
$ yarn install
```

The `distribufy` and `distribufy-compiler` workspaces contain the Distribufy
runtime and compiler code respectively.

## Usage

Distribufy consists of a command-line compiler and runtime framework for
checkpointing cloud functions.

Recommended usage is to install the compiler globally, and install the
`distribufy` package as a dependency in your project's `package.json`.

### Compiler: `distribufy`

The `distribufy` command compiles programs and instruments them to
support capturing continuations. The default invocation from the command line
is:
```bash
$ distribufy <src> <dst> --func -t catch
```

These command line flags require brief explanation.

 - `--func` tells the compiler not to wrap the source file in a top-level
 function. Without this option, extra insrumentation is injected to generate
 a standalone, runnable output file. Distribufy relies on programs being
 wrapped by its launcher to run.

 - `-t catch` tells the compiler which instrumentation method to use to
 capture continuations. This strategy has shown the best performance on some
 benchmarks.

### Deployment

Compiled programs can be deployed and run on OpenWhisk. This requires
deploying a `zip` action structured in a certain way. The following commands
show how to set up a local dev environment, and compile, deploy, and invoke
checkpointing functions.

#### Initializing a cloud function project

First, install the `distribufy@compiler` package globally, and initialize a
local npm project.
```bash
$ # Install the `distribufy-compiler` package globally
$ npm install -g distribufy-compiler
$ mkdir <project-root> && cd <project-root>
$ npm init -y
```

From the root of the new project, install the `distribufy` package as a
dependency in `package.json`.
```bash
$ npm install distribufy
```

Modify the `main` entrypoint of `package.json`.
```js
{
  ...
  "main": "node_modules/distribufy/dist/src/cloud.js",
  ...
}
```

#### Compiling and deploying a checkpointing cloud function

Once the cloud function project has been properly initialized, we can
develop, compile, and deploy our checkpointing cloud function.

First, compile the source program into `node_modules/distribufy/dist/tmp.js`.
```bash
$ distribufy <src> node_modules/distribufy/dist/tmp.js --func -t catch
```

Next, create the `.zip` archive to be deployed.
```bash
$ zip -r <action>.zip node_modules package.json
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

## Assumptions

There are some limitations on the types of programs currently supported by
Distribufy. These are listed and discussed briefly.

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
const runtime = require('distribufy');
const utils = runtime.require('distribufy/dist/src/utils/utils')
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
const runtime = require('distribufy');

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
which mutate captured state. The top-level `require('assert')` is also closed
over by the function `main`.

```js
const runtime = require('distribufy');
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
const runtime = require('distribufy');
const utils = runtime.require('distribufy/dist/src/utils/utils')
  .register(runtime, '<external-service-url>');

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
  const response = utils.invoke('http', options);

  return {
    input: options,
    output: response,
  };
}

module.exports = main;
```