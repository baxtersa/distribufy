const assert = require('assert');

let i = 0;

function h() {
  console.log('foo');
  return 1;
}

function f() {
  while (false) {}
}

async function g() {
  while (false) {}
  await Promise.resolve((f(), 1));
  console.log('sleeping within g');
  $__D.sleep(1000);
  return Promise.resolve(i);
}

async function j() {
  let v = await Promise.resolve(42)
  assert.equal(v, 42);
  console.log('starting');
  $__D.sleep(1000);
  console.log('sleep 1');
  $__D.sleep(1000);
  console.log('done waiting...');
  f();
  assert.equal(i, 0);
  i = v;
  v = await g();

  console.log('sleeping after g');
  $__D.sleep(1000);

  assert.equal(i, v);
  console.log('done');
}

$__R.promise(j());

assert.equal(i, 0);
console.log('end');
