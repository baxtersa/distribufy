# Checkpointing Modules

Distribufy exposes a `checkpoint` function which serializes continuations.
Checkpoints offer a foundation for building libraries which suspend execution
while communicating with external services, and restore from the checkpoint
upon their completion.

## HTTP

HTTP requests are the canonical example of asynchronous I/O. We develop a
[HTTP module](./src/utils/http.ts) to demonstrate how to use Distribufy's
`checkpoint` function to build suspendable compositions with external
services.

## Examples

This program uses our HTTP module to make a request and checkpoint the cloud
function, then restore execution from the checkpoint before completing.

```js
const http = require('./src/utils/http');

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