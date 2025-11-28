"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const url = 'mongodb://127.0.0.1:27017';
const db = 'HIBP';
const client = new mongodb_1.MongoClient(url);
const wait = async (ms) => new Promise(done => setTimeout(done, ms));
async function getBreaches(email, key) {
    const apiUrl = 'https://haveibeenpwned.com/api/v3/breachedaccount/' + email;
    let response;
    await axios_1.default.get(apiUrl, {
        headers: { 'hibp-api-key': key }
    })
        .then(async (res) => {
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
        .catch((err) => {
        if (err.response) {
            switch (err.response.status) {
                case 429: // Rate Limited: return the time that the script must wait before trying again
                    console.log(email, err.response.statusText + ' ' + err.response.data.message);
                    const match = err.response.data.message.match(/[0-9]/);
                    response = match ? match[0] * 1000 + 800 : undefined;
                    break;
                default:
                    console.log(email, err.response.status + ' ' + err.response.statusText);
            }
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
    }
    catch (err) {
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
    }).catch((err) => {
        if (err.code === 11000)
            console.log(email, 'duplicate');
        else
            console.log(err);
    });
    return;
}
async function main() {
    const config = JSON.parse(fs_1.default.readFileSync('./config.json', 'utf-8'));
    await ensureUniqueIndex();
    const data = fs_1.default.readFileSync('data.txt', 'utf-8');
    const allFileContents = data.split(/\r?\n/);
    for (const line of allFileContents) {
        const match = line.match(/[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+(?:\.[-A-Za-z0-9!#$%&'*+/=?^_`{|}~]+)*@(?:[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[-A-Za-z0-9]*[A-Za-z0-9])?/);
        if (match === null)
            continue;
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
