const assert = require('assert');

let y = 1;

function f(x) {
  let obj = {
    a: {
      a2: 8
    }
  };
  function g() {
    {
      return obj.a.a2;
    }
  }
  let z = 7;
  return x + y + z;
}

assert.equal(f(3), 11);
