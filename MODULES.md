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

User code can consume modules by calling `runtime.require` on the module
path, and then calling the `register` function on the object returned by
`runtime.require`.

```js
const runtime = require('./src/index');                 // `require` a `CheckpointRuntime` instance
const mod = runtime.require('<module-path>').register(runtime); // Register an extension module
```

## HTTP

HTTP requests are the canonical example of asynchronous I/O. We develop a
[HTTP module](./src/utils/http.ts) to demonstrate how to use Distribufy's
`checkpoint` function to build suspendable compositions with external
services. The HTTP module takes an additional `serviceUrl` parameter for its
`register` function. This URL should be the address of an external service
which will make the actual HTTP request, and resume the original action from
the checkpoint where the request was made.

## Utils

The `Utils` module exposes a function `action`, which lets users checkpoint
programs, call an external action asynchronously, and resume the original
action from the checkpoint upon its completion.

## Cloudant

The `Cloudant` module exposes functions to interact with a Cloudant database
asynchronously.

## Parallel

The `Parallel` module implements combinators to execute asyncrhonous actions
in parallel. The parallel branches are assumed to be deployed actions which
execute synchronously (i.e. they themselves do not checkpoint their
execution).

## Examples

### Checkpointing HTTP GET

This program uses our HTTP module to make a request and checkpoint the cloud
function, then restore execution from the checkpoint before completing.

```js
const runtime = require('./src/index');
const http = require('./src/utils/http').register(runtime, '<http-service-url>');

function main(params) {
  const url = params.url;

  const response = http.get(url);

  return {
    input: url,
    output: response,
  };
}

module.exports = main;
```

### Flu Report Processing

This program demonstrates a more fully featured application, using multiple extension modules.

`flureport.js`

```js
const serviceUrl = '<external-service-url>';

const runtime = require('./src/index');
const utils = runtime.require('./src/utils/utils')
  .register(runtime, serviceUrl);
const parallel = runtime.require('./src/utils/parallel')
  .register(runtime, serviceUrl);
const http = runtime.require('./src/utils/http')
  .register(runtime, serviceUrl);

function parseReport(x) {
  var dt = x._attributes.subtitle.match(/Week Ending (.*)- Week .*/)[1];
  return x.state.map(s => ({
    year: x._attributes.year,
    week: x._attributes.number,
    dt: Date.parse(dt),
    color: s.color[0],
    state: s.abbrev[0]
  }));
}

function main(params) {
  // ingest and parse xml reports into JSON
  const flureport = http.get('https://www.cdc.gov/flu/weekly/flureport.xml');
  const reportJson = utils.action('jsonify', flureport);

  // iterate over each time period
  const slices = reportJson.flureport.timeperiod.slice(0, 1);
  for (let i = 0; i < slices.length; i++) {
    const report = slices[i];
    const parsed = parseReport(report);

    // Format and upsert reports into Cloudant database in parallel.
    const results = parallel.map('cloudant-upsert', parsed);

    console.log(results);
  }

  return { message: 'Flu Report Processed' };
}

module.exports = main;
```

```js
const runtime = require('./src/index');
const cloudant = runtime.require('./src/utils/cloudant')
  .register(runtime, '<external-service-url>');

function formatReport(x) {
  function getColor(x) {
    const map = {
      "No Report": "white",
      "No Activity": "green",
      "Sporadic": "yellow",
      "Local Activity": "orange",
      "Regional": "red",
      "Widespread": "purple"
    }

    return map[x]
  }

  function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ?
      n :
      new Array(width - n.length + 1).join(z) + n;
  }

  const dt = new Date(x.dt)
  dt.setHours(12)
  const dts = dt.toISOString()
  const m = pad(dt.getMonth() + 1, 2)
  const d = pad(dt.getDate(), 2)
  const y = dt.getFullYear()
  const h = pad(dt.getHours(), 2)
  const M = pad(dt.getMinutes(), 2)
  const s = pad(dt.getSeconds(), 2)
  return {
    meta: {
      state: x.state,
      date: parseInt("" + y + m + d)
    },
    rec: {
      FUHdr: {
        FUstCd: x.state,
        FUprsntNm: x.state,
        procTm: parseInt("" + y + m + d + h + M + s),
        procTmISO: dts
      },
      FUData: {
        FUoutBrkCd: getColor(x.color),
        FUdt: "" + m + d + y + h + M + s,
        meaning: x.color,
        FUdtISO: dts
      }
    }
  }
}

const chost = '{{{CLOUDANT_HOST}}}';
const cauth = '{{{CLOUDANT_AUTH}}}';

function upsert(key, value, options) {
  const getResult = cloudant.get(key, options);

  if (getResult.result.error === undefined) {
    value._id = getResult.result._id;
    value._rev = getResult.result._rev;
  }

  return cloudant.insert(key, value, options);
}

function main(report) {
  const formattedReport = formatReport(report);


  const key = formattedReport.meta.date + '-' + formattedReport.meta.state;
  const value = formattedReport.rec;

  return upsert(key, value, { host: chost, auth: cauth, db: 'twc-flu' });
}

module.exports = main;
```