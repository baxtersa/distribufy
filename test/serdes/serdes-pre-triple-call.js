const assert = require('assert');
const pickle = require('../../dist/src/pickler');

let x = 0;
let y = 0;
let z = 0;

function foo() {
  let x = foo.__free__.x,
      y = foo.__free__.y,
      z = foo.__free__.z;

  foo.__free__.x++;
  function bar() {
    let y = bar.__free__.y,
        z = bar.__free__.z;

    bar.__free__.y++;
    function baz() {
      let z = baz.__free__.z;

      baz.__free__.z++;
      return 1;
    }
    baz.__free__ = {
      z
    };
    return {
      baz
    };
  }
  bar.__free__ = {
    y,
    z
  };
  return {
    bar
  };
}

foo.__free__ = {
  x,
  y,
  z
};

const js = new pickle.Pickler();
const dejs = new pickle.Depickler();

const buf = js.serialize(foo);
const bar = dejs.deserialize(buf);

assert.equal(1, bar().bar().baz());

