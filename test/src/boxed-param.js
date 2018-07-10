const assert = require('assert');

function box(a) {

  function close() {
    return ++a;
  }

  return close();
}

function main() {
  assert.equal(box(7), 8);
}

module.exports = main;
