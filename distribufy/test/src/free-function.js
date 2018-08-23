const assert = require('assert');

function g() {
  $__D.checkpoint();
  return 7;
}

function f() {
  $__D.checkpoint();
  return g() + 1;
}

function main() {
  assert.equal(f(), 8);
}

module.exports = main
