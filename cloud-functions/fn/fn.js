function main() {
  const options = {
    method: 'GET',
    uri: 'api.open-notify.org/iss-now.json',
  };

  const response = $__D.invoke('http', options);

  return {
    input: options,
    output: response,
  };
}

module.exports = main;