const rp = require('request-promise-native');
const assert = require('assert');

const URL = 'https://httpbin.org/get';
const options = {
  uri: URL,
  method: 'GET',
  json: true,
};

function requestThen() {
  console.log('promising');
  return rp(options).then(v => {
    console.log('promised');
    $__D.sleep(1000);
    assert.equal(URL, v.url);
    console.log('asserted');
  });
}

function main() {
  $__D.sleep(1000);
  console.log('requesting');
  requestThen();
  console.log('requested');
  $__D.sleep(1000);
}

module.exports = main;
