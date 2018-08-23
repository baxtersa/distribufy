const rp = require('request-promise-native');
const assert = require('assert');

const URL = 'https://httpbin.org/get';
const options = {
  uri: URL,
  method: 'GET',
  json: true,
};

async function requestAwait() {
  console.log('awaiting');
  const v = await rp(options)
  console.log('awaited');
  $__D.sleep(1000);
  assert.equal(URL, v.url);
  console.log('asserted');
}

function main() {
  $__D.sleep(1000);
  console.log('requesting');
  $__D.promise(requestAwait());
  console.log('requested');
  $__D.sleep(1000);
}

module.exports = main;
