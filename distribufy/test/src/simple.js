const assert = require('assert');

function main() {
  let y = 1;

  function f(x) {
    $__D.checkpoint();
    let obj = {
      a: {
        a2: 8
      }
    };
    function g() {
      $__D.checkpoint();
      {
        return obj.a.a2;
      }
    }
    let z = 7;
    return x + y + z;
  }

  assert.equal(f(3), 11);
}

module.exports = main;
