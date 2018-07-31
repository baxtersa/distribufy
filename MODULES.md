# Checkpointing Modules

Distribufy exposes a `checkpoint` function which serializes continuations.
Checkpoints offer a foundation for building libraries which suspend execution
while communicating with external services, and restore from the checkpoint
upon their completion.

## The Module Interface

Modules make use of the `checkpoint` method of a `CheckpointRuntime`
instance. This means modules must lazily "register" exported functions after
a `CheckpointRuntime` object has been instantiated. The interface for
defining a module should export a `register` function, which takes a
`CheckpointRuntime` object as input, and returns an object containing the
functions to be exported.

```ts
export function register(runtime: CheckpointRuntime) {
  ...
  return { `<exported functions>` };
}
```

User code can consume modules by calling `register` on the `require`'d module.

```js
const runtime = require('./src/index');                 // `require` a `CheckpointRuntime` instance
const mod = require('<module-path>').register(runtime); // Register an extension module
```

## HTTP

HTTP requests are the canonical example of asynchronous I/O. We develop a
[HTTP module](./src/utils/http.ts) to demonstrate how to use Distribufy's
`checkpoint` function to build suspendable compositions with external
services. The HTTP module takes an additional `serviceUrl` parameter for its
`register` function. This URL should be the address of an external service
which will make the actual HTTP request, and resume the original action from
the checkpoint where the request was made.

## Examples

This program uses our HTTP module to make a request and checkpoint the cloud
function, then restore execution from the checkpoint before completing.

```js
const runtime = require('./src/index');
const http = require('./src/utils/http').register(runtime, '<http-service-url>');

function main() {
  const options = {
    method: 'GET',
    uri: 'api.open-notify.org/iss-now.json',
  };

  const response = http.get('api.open-notify.org/iss-now.json');

  return {
    input: options,
    output: response,
  };
}

module.exports = main;
```