const { parseString } = require('xml2js');

function main(params) {
  const { body } = params;

  return new Promise((resolve, reject) => {
    try {
      return parseString(body, { attrkey: '_attributes' }, (err, result) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(result);
        }
      });
    } catch (err) {
      console.error(err);
      reject(err.toString());
    }
  });
}

module.exports = main;
