const { MongoClient } = require('mongodb');
const fs = require('fs');
const axios = require('axios');

const url = 'mongodb://127.0.0.1:27017';
const db = 'HIBP';
const client = new MongoClient(url);

const wait = async ms => new Promise(done => setTimeout(done, ms));

async function getBreaches(email, key) {
  let url = 'https://haveibeenpwned.com/api/v3/breachedaccount/' + email;

  let response;

  await axios.get(url, {
    headers: {'hibp-api-key': key}
  })
  .then(async res => {
    switch (res.status) {
      case 200: // OK
        console.log(email, res?.data);
        await addBreaches(email, res?.data);
        break;
      default:
        console.log(email, res.statusText,)
    }

    return;
  })
  .catch(err => {
    switch (err.response.status) {
      case 429: // Rate Limited: return the time that the script must wait before trying again
        console.log(email, err.response.statusText + ' ' + err.response.data.message);
        response = err.response.data.message.match(/[0-9]/)[0]*1000+800;
        break;
      default:
        console.log(email, err.response.status + ' ' + err.response.statusText);
    }
  });

  return response;
}

async function ensureUniqueIndex() {
  await client.connect();
  const collection = client.db(db).collection('Breaches');

  try {
    await collection.createIndex({ email: 1 }, { unique: true });
    console.log('Unique index on email field ensured');
  } catch (err) {
    // Index might already exist, that's okay
    if (err.code !== 85) { // 85 = IndexOptionsConflict
      console.log('Index creation note:', err.message);
    }
  }
}

async function addBreaches(email, breaches) {
  await client.connect();
  const collection = client.db(db).collection('Breaches');

  await collection.insertOne({
    email: email,
    breaches: breaches
  }).catch(err => {
    if (err.code === 11000) console.log(email, 'duplicate');
    else console.log(err);
  });

  return;
}

async function main() {
  const config = await JSON.parse(fs.readFileSync('./config.json'));

  await ensureUniqueIndex();

  const data = fs.readFileSync('data.txt', 'utf-8');
  let allFileContents = data.split(/\r?\n/)
  for (i in allFileContents) {
    line = allFileContents[i];
    let match = line.match(/[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+(?:\.[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+)*@(?:[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?/)
    if (match === null) continue;
    let email = match[0];
    let response = await getBreaches(email, config.key);

    if (response !== undefined) { // this is the case where the script is rate limited and must wait
      await wait(response);
      await getBreaches(email, config.key);
    }

    await wait(config.delay);
  }

  return console.log('Done');
}
main();