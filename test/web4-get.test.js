const test = require('tape');
const fs = require('fs');
const bs58 = require('bs58');
const crypto = require('crypto');

process.env.FAST_NEAR_STORAGE_TYPE = 'lmdb';

// create a temporary directory for the test
const tmpDataDir = fs.mkdtempSync('/tmp/fast-near-storage-test-');
console.log('Using temporary directory for LMDB storage:', tmpDataDir);
process.env.FAST_NEAR_LMDB_PATH = tmpDataDir;

const TEST_FAST_NEAR_PORT = 13000; // TODO: Pick open port
const fastNEAR = require('fast-near');
const fastNEARServer = fastNEAR.listen(TEST_FAST_NEAR_PORT);
process.env.FAST_NEAR_URL = `http://localhost:${TEST_FAST_NEAR_PORT}`;
process.env.NEARFS_GATEWAY_URL = 'https://ipfs.web4.near.page';

const { closeWorkerPool } = require('fast-near/run-contract');
test.onFinish(async () => {
    await closeWorkerPool();
    await new Promise((resolve) => fastNEARServer.close(resolve));
});

const app = require('../app');
const request = require('supertest')(app.callback());

const { dumpChangesToStorage } = require('fast-near/scripts/load-from-near-lake');

const sha256 = (data) => {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest();
}

async function cleanup() {
    // TODO: Clear database?
}

const TEST_CONTRACT_CODE = fs.readFileSync('./test/data/web4-min.wasm');

const STREAMER_MESSAGE = {
    block: {
        header: {
            height: 1,
            hash: '68dDfHtoaRwBM79uRWnQJ1eMSgehPW8JtnNRWkBpX87e',
            timestamp: Math.floor(Date.now() * 1000000)
        }
    },
    shards: [{
        stateChanges: [{
            type: 'account_update',
            change: {
                accountId: 'no-code.near',
                amount: '4936189930936415601114966690',
                codeHash: '11111111111111111111111111111111',
                locked: '0',
                storageUsage: 20797,
            }
        }, {
            type: 'account_update',
            change: {
                accountId: 'test.near',
                amount: '4936189930936415601114966690',
                codeHash: bs58.encode(sha256(TEST_CONTRACT_CODE)),
                locked: '0',
                storageUsage: 20797,
            }
        }, {
            type: 'contract_code_update',
            change: {
                accountId: 'test.near',
                codeBase64: TEST_CONTRACT_CODE.toString('base64'),
            }
        }, {
            type: 'account_update',
            change: {
                accountId: 'set-static-url.near',
                amount: '4936189930936415601114966690',
                codeHash: bs58.encode(sha256(TEST_CONTRACT_CODE)),
                locked: '0',
                storageUsage: 20797,
            }
        }, {
            type: 'contract_code_update',
            change: {
                accountId: 'set-static-url.near',
                codeBase64: TEST_CONTRACT_CODE.toString('base64'),
            }
        }, {
            type: 'data_update',
            change: {
                accountId: 'set-static-url.near',
                keyBase64: Buffer.from('web4:staticUrl').toString('base64'),
                // NOTE: See web4-littlelink project for source of this IPFS hash. Using littlelink.car from fast-ipfs/test/data
                valueBase64: Buffer.from('ipfs://bafybeiepywlzwr2yzyin2bo7k2v5oi37lsgleyvfrf6erjvlze2qec6wkm').toString('base64'),
            }
        }]
    }],
}

test('web4-min test.near.page/', async t => {
    t.teardown(cleanup);

    await dumpChangesToStorage(STREAMER_MESSAGE);

    const res = await request
        .get('/')
        .set('Host', 'test.near.page');
    
    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    t.match(res.text, /Welcome to Web4!/);
});

test('web4-min set-static-url.near.page/css/brands.css (passthrough content type)', async t => {
    t.teardown(cleanup);

    await dumpChangesToStorage(STREAMER_MESSAGE);

    const res = await request
        .get('/css/brands.css')
        .set('Host', 'set-static-url.near.page');

    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'text/css; charset=utf-8');
    t.match(res.text, /Skeleton V2.0.4/);
});

