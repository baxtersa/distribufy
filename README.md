# Distribufy

Distribufy is an extension to
[Stopify](https://github.com/plasma-umass/Stopify) implementing serializable
continuations. Distribufy levarages serializable continuations to build a
synchronous programming model for asynchronous I/O on the serverless
[OpenWhisk](https://openwhisk.apache.org) platform.

Distribufy exposes a function `$__D.checkpoint` to JavaScript programs, which
captures and serializes a programs continuation. Checkpoints provide the
basis for more complex compositions of I/O driven programs.

## Building
---

Distribufy builds against a branch of Stopify which must be built from
source. The following steps should get your environment up and running.

- First, clone and build Stopify locally.
```bash
$ git clone https://github.com/plasma-umass/Stopify.git --branch distribufy stopify
$ cd stopify
$ yarn install && yarn build
```

- Next, link the local Stopify packages.
```bash
$ cd <stopify-root>/stopify-continuations
$ yarn link
$ cd <stopify-root>/stopify-estimators
$ yarn link
```

- Now clone Distribufy and link against the local Stopify packages from the
previous step.
```bash
$ git clone https://github.com/baxtersa/distribufy.git
$ cd distribufy
$ yarn link stopify-continuations stopify-estimators
```

- And finally you should be able to build Distribufy.
```bash
$ cd <distribufy-root>
$ yarn build
```

## Usage
---

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

Again, if the program reaches a checkpoint, a continuation will be serialized to the
file `continuation.data` on disk.

#### Running end-to-end

If you want to run a program end-to-end, resuming each checkpoint automatically, you can run the following command.

```bash
$ bin/run-dist <program> --loop
```

## Assumptions
---

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
---

### Simple Checkpointing

This program prints a line before and after a checkpoint, demonstrating that
sequential code is properly checkpointed and not re-executed upon resumption.

```js
function main() {
  console.log('before checkpoint');
  $__D.checkpoint();
  console.log('after checkpoint');
}

module.exports = main;
```

### Nondeterministic Top-level Declarations

Nondeterministic top-level program statements can be persisted
across checkpoints. Without calling `$__D.persist`, each log would print a
unique timestamp.

```js
let timestamp = $__D.persist('i', () => Date.now());

function checkpointThenTimestamp() {
  $__D.checkpoint();
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
const assert = require('assert');

function main() {
  let x = 0;
  let y = 1;
  let z = 2;

  function foo() {
    $__D.checkpoint();
    x++;
    function bar() {
      $__D.checkpoint();
      y++;
      function baz() {
        $__D.checkpoint();
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