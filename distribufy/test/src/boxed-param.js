const assert = require('assert');

function box(a) {
  $__D.checkpoint();

  function close() {
    $__D.checkpoint();
    return ++a;
  }

  return close();
}

function main() {
  assert.equal(box(7), 8);
}

module.exports = main;
