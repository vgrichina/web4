const test = require('tape');
const fs = require('fs');
const bs58 = require('bs58');
const crypto = require('crypto');
const { KeyPair, transactions: { Transaction, SCHEMA } } = require('near-api-js');

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
    await setup(t);

    const res = await request
        .get('/')
        .set('Host', 'test.near.page');

    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    t.match(res.text, /Welcome to Web4!/);
});

test('web4-min set-static-url.near.page/css/brands.css (passthrough content type)', async t => {
    await setup(t);

    const res = await request
        .get('/css/brands.css')
        .set('Host', 'set-static-url.near.page');

    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'text/css; charset=utf-8');
    t.match(res.text, /Skeleton V2.0.4/);
});

test('test.near.page/web4/login', async t => {
    await setup(t);

    const res = await request
        .get('/web4/login')
        .set('Host', 'test.near.page');

    t.equal(res.status, 302);
    t.equal(res.headers['content-type'], 'text/html; charset=utf-8');
    t.match(res.text, /Redirecting to/);
    const location = res.headers['location'];
    t.match(location, /https:\/\/wallet.testnet.near.org\/login\/?/);

    const searchParams = new URL(location).searchParams;
    const callbackUrl = 'http://test.near.page/web4/login/complete?web4_callback_url=http%3A%2F%2Ftest.near.page%2F';
    t.equal(searchParams.get('success_url'), callbackUrl);
    t.equal(searchParams.get('failure_url'), callbackUrl);
    t.equal(searchParams.get('contract_id'), 'test.near');
    const publicKey = searchParams.get('public_key');
    t.match(publicKey, /^ed25519:/);

    const cookies = parseCookies(res);
    t.equal(cookies.web4_account_id, '');
    t.ok(cookies.web4_private_key);

    const keyPair = KeyPair.fromString(cookies.web4_private_key);
    t.equal(publicKey, keyPair.getPublicKey().toString());
});

test('test.near.page/web4/login/complete missing callback', async t => {
    await setup(t);

    const res = await request
        .get('/web4/login/complete')
        .set('Host', 'test.near.page');

    t.equal(res.status, 400);
    t.equal(res.text, 'Missing web4_callback_url');
});

test('test.near.page/web4/login/complete missing account_id', async t => {
    await setup(t);

    const res = await request
        .get('/web4/login/complete?web4_callback_url=http%3A%2F%2Ftest.near.page%2F')
        .set('Host', 'test.near.page');

    t.equal(res.status, 302);
    t.equal(res.headers['location'], 'http://test.near.page/');
    const cookies = parseCookies(res);
    t.false(cookies.web4_account_id);
});

test('test.near.page/web4/login/complete success', async t => {
    await setup(t);

    const res = await request
        .get('/web4/login/complete?web4_callback_url=http%3A%2F%2Ftest.near.page%2F&account_id=test.near')
        .set('Host', 'test.near.page');

    t.equal(res.status, 302);
    t.equal(res.headers['location'], 'http://test.near.page/');
    const cookies = parseCookies(res);
    t.equal(cookies.web4_account_id, 'test.near');
});

test('test.near.page/web4/logout', async t => {
    await setup(t);

    const res = await request
        .get('/web4/logout')
        .set('Host', 'test.near.page');

    t.equal(res.status, 302);
    t.equal(res.headers['location'], 'http://test.near.page/');

    const cookies = parseCookies(res);
    t.false(cookies.web4_account_id);
    t.false(cookies.web4_private_key);
});

test('test.near.page/web4/logout with callback', async t => {
    await setup(t);

    const res = await request
        .get('/web4/logout?web4_callback_url=http%3A%2F%2Ftest.near.page%2Fcallback')
        .set('Host', 'test.near.page');

    t.equal(res.status, 302);
    t.equal(res.headers['location'], 'http://test.near.page/callback');

    const cookies = parseCookies(res);
    t.false(cookies.web4_account_id);
    t.false(cookies.web4_private_key);
});

test('/web4/contract/test.near/web4_get method call', async t => {
    await setup(t);

    const res = await request
        .get('/web4/contract/test.near/web4_get');

    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    t.equal(res.text, '{"status":200,"bodyUrl":"ipfs://bafybeidc4lvv4bld66h4rmy2jvgjdrgul5ub5s75vbqrcbjd3jeaqnyd5e/"}');
});

test('/web4/contract/test.near/web4_get method call with JSON args', async t => {
    await setup(t);

    const res = await request
        .get('/web4/contract/test.near/web4_get')
        .query({ 'request.json': JSON.stringify({ path: '/some-path' }) });

    t.equal(res.status, 200);
    t.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    t.equal(res.text, '{"status":200,"bodyUrl":"ipfs://bafybeidc4lvv4bld66h4rmy2jvgjdrgul5ub5s75vbqrcbjd3jeaqnyd5e/some-path"}');
});

test('/web4/contract/test.near/web4_setStaticUrl method call through wallet', async t => {
    await setup(t);

    const res = await request
        .post('/web4/contract/test.near/web4_setStaticUrl')
        .set('Host', 'test.near.page')
        .set('Cookie', 'web4_account_id=logged-in.near')
        .send({ url: 'test://url' });

    t.equal(res.status, 302);
    const { location } = res.headers;
    t.match(location, /https:\/\/wallet.testnet.near.org\/sign\/?/);
    const { searchParams } = new URL(location);
    console.log('callbackUrl', searchParams.get('callbackUrl'));
    t.equal(searchParams.get('callbackUrl'), 'http://test.near.page/');
    const transactionBase64 = searchParams.get('transactions');
    t.ok(transactionBase64);
    const transactionData = Buffer.from(transactionBase64, 'base64');
    const transaction = Transaction.decode(transactionData);
    t.ok(transaction.actions);
    t.equal(transaction.receiverId, 'test.near');
    t.equal(transaction.signerId, 'logged-in.near');
    t.equal(transaction.actions.length, 1);
    const { functionCall } = transaction.actions[0];
    t.equal(functionCall.methodName, 'web4_setStaticUrl');
    t.equal(Buffer.from(functionCall.args).toString('utf8'), '{"url":"test://url"}');
});

async function setup(t) {
    t.teardown(cleanup);
    await dumpChangesToStorage(STREAMER_MESSAGE);
}

function parseCookies(res) {
    const cookies = {};
    for (const cookie of (res.headers['set-cookie'] || [])) {
        const [key, value] = cookie.split('=');
        cookies[key] = value.split(';')[0];
    }
    return cookies;
}

