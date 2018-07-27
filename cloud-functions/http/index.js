const needle = require('needle');


function main(params) {
  const { method, uri } = params;

  return needle(method, uri, { json: true })
    .then(response => response.body);
}
