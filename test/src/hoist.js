const assert = require('assert');

function apply(f, args) {
  return f.apply({}, args);
}

function main() {
  assert.equal(apply(inc, [7]));

  function inc(x) {
    return x + 1;
  }
}


module.exports = main;
