const cloudant = require('@cloudant/cloudant');

function main(params) {
  const { key, value, url, password, db: dbName } = params;

  const client = cloudant({ account: url, password });

  const db = client.db.use(dbName);

  return new Promise((resolve, reject) => {
    db.insert(value, key, (err, body) => {
      if (err) {
        console.log(`[${db}.insert]`, err.message);
        return reject(err);
      }

      return resolve(body);
    });
  })
}

module.exports = main;