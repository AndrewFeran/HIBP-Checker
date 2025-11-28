import { MongoClient, Collection, MongoError } from 'mongodb';
import fs from 'fs';
import axios, { AxiosError } from 'axios';

interface Config {
  key: string;
  delay: number;
  mongoUri: string;
  database: string;
  collection: string;
}

interface Breach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  LogoPath: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
  IsMalware: boolean;
  IsSubscriptionFree: boolean;
}

interface BreachDocument {
  email: string;
  breaches: Breach[];
}

let client: MongoClient;
let dbName: string;
let collectionName: string;

const wait = async (ms: number): Promise<void> => new Promise(done => setTimeout(done, ms));

async function getBreaches(email: string, key: string): Promise<number | undefined> {
  const apiUrl = 'https://haveibeenpwned.com/api/v3/breachedaccount/' + email;

  let response: number | undefined;

  await axios.get<Breach[]>(apiUrl, {
    headers: { 'hibp-api-key': key }
  })
    .then(async res => {
      switch (res.status) {
        case 200: // OK
          console.log(email, res?.data);
          await addBreaches(email, res?.data);
          break;
        default:
          console.log(email, res.statusText);
      }

      return;
    })
    .catch((err: AxiosError) => {
      if (err.response) {
        switch (err.response.status) {
          case 429: // Rate Limited: return the time that the script must wait before trying again
            console.log(email, err.response.statusText + ' ' + (err.response.data as any).message);
            const match = (err.response.data as any).message.match(/[0-9]/);
            response = match ? match[0] * 1000 + 800 : undefined;
            break;
          default:
            console.log(email, err.response.status + ' ' + err.response.statusText);
        }
      }
    });

  return response;
}

async function ensureUniqueIndex(): Promise<void> {
  await client.connect();
  const collection = client.db(dbName).collection(collectionName);

  try {
    await collection.createIndex({ email: 1 }, { unique: true });
  } catch (err) {
    // Index might already exist, that's okay
    if ((err as MongoError).code !== 85) { // 85 = IndexOptionsConflict
      console.log('Index creation note:', (err as Error).message);
    }
  }
}

async function addBreaches(email: string, breaches: Breach[]): Promise<void> {
  await client.connect();
  const collection: Collection<BreachDocument> = client.db(dbName).collection(collectionName);

  await collection.insertOne({
    email: email,
    breaches: breaches
  }).catch((err: MongoError) => {
    if (err.code === 11000) console.log(email, 'duplicate');
    else console.log(err);
  });

  return;
}

async function main(): Promise<void> {
  const config: Config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

  // Initialize MongoDB connection
  client = new MongoClient(config.mongoUri);
  dbName = config.database;
  collectionName = config.collection;

  await ensureUniqueIndex();

  const data = fs.readFileSync('data.txt', 'utf-8');
  const allFileContents = data.split(/\r?\n/);

  for (const line of allFileContents) {
    const match = line.match(/[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+(?:\.[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+)*@(?:[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?/);
    if (match === null) continue;

    const email = match[0];
    const response = await getBreaches(email, config.key);

    if (response !== undefined) { // this is the case where the script is rate limited and must wait
      await wait(response);
      await getBreaches(email, config.key);
    }

    await wait(config.delay);
  }

  console.log('Done');
  process.exit(0);
}

main();
