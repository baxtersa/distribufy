const assert = require('assert');
let x = 0;
let y = 0;
let z = 0;

function foo() {
  while (false) {}
  x++;
  function bar() {
    while (false) {}
    y++;
    function baz() {
      while (false) {}
      z++;
      return x+y+z;
    }
    return {
      baz,
    }
  }
  return {
    bar,
  }
}

const a = foo().bar().baz();

assert.equal(a, 1);
assert.equal(x, 1);
assert.equal(y, 1);
assert.equal(z, 1);
