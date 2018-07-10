function apply(f, args) {
  return f.apply({}, args);
}

function main() {
  console.log(apply(inc, [7]));

  function inc(x) {
    return x + 1;
  }
}


module.exports = main;
