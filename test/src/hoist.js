const assert = require('assert');

function apply(f, args) {
  $__D.checkpoint();
  return f.apply({}, args);
}

function main() {
  assert.equal(apply(inc, [7]), 8);

  function inc(x) {
    $__D.checkpoint();
    return x + 1;
  }
}


module.exports = main;
