const {
    connect,
    keyStores: { InMemoryKeyStore },
    WalletConnection,
    ConnectedWalletAccount,
    transactions: { functionCall },
} = require('near-api-js');

const qs = require('querystring');

async function withNear(ctx, next) {
    const config = require('./config')(process.env.NODE_ENV || 'development')
    // TODO: Why no default keyStore?
    const keyStore = new InMemoryKeyStore();
    const near = await connect({...config, keyStore});

    Object.assign(ctx, { config, keyStore, near });

    await next();
}

const Koa = require('koa');
const app = new Koa();

const Router = require('koa-router');
const router = new Router();

const koaBody = require('koa-body')();

router.get('/web4/contract/:contractId/:methodName', withNear, async ctx => {
    const {
        params: { contractId, methodName },
        query,
        near
    } = ctx; 

    const methodParams = Object.keys(query)
        .map(key => key.endsWith('.json')
            ? { [key.replace(/\.json$/, '')]: JSON.parse(query[key]) }
            : { [key] : query[key] })
        .reduce((a, b) => ({...a, ...b}), {});

    const account = await near.account(contractId);

    ctx.body = await account.viewFunction(contractId, methodName, methodParams);
});

router.get('/web4/login', withNear, async ctx => {
    // TODO: Generate private key, return in cookie?

    const walletConnection = new WalletConnection(ctx.near);
    
    // TODO: Should allow passing callback URL?
    const loginCompleteUrl = `${ctx.origin}/web4/login/complete`;
    ctx.redirect(walletConnection.signInURL({
        successUrl: loginCompleteUrl,
        failureUrl: loginCompleteUrl
    }))
});

router.get('/web4/login/complete', async ctx => {
    const { account_id, all_keys } = ctx.query;
    if (account_id) {
        ctx.cookies.set('web4_account_id', account_id);
        ctx.cookies.set('web4_all_keys', all_keys);
        ctx.body = `Logged in as ${account_id}`;
    } else {
        ctx.body = `Couldn't login`;
    }
});

router.post('/web4/logout');
// TODO: Remove private key cookie (ideally also somehow remove key from account?)

const DEFAULT_GAS = '300' + '000000000000';

router.post('/web4/contract/:contractId/:methodName', koaBody, withNear, async ctx => {
    // TODO: Sign transaction with private key and account from cookies
    // TODO: Accept both json and form submission

    const accountId = ctx.cookies.get('web4_account_id');
    if (!accountId) {
        ctx.redirect('/web4/login');
        return;
    }

    const allKeys = (ctx.cookies.get('web4_all_keys') || '').split(',');

    const { contractId, methodName } = ctx.params;
    const { body } = ctx.request;
    const { web4_gas: gas, web4_deposit: deposit } = body;
    const args = Object.keys(body)
        .filter(key => !key.startsWith('web4_'))
        .map(key => ({ [key]: body[key] }))
        .reduce((a, b) => ({...a, ...b}), {});

    // TODO: Test this
    const walletConnection = new WalletConnection(ctx.near, 'web4', { allKeys });
    const account = new ConnectedWalletAccount(walletConnection, ctx.near.connection, accountId);
    // TODO: walletConnection.account();
    const transaction = await account.createTransaction(contractId, [
        functionCall(methodName, args, gas || DEFAULT_GAS, deposit || '0')
    ]);
    const url = walletConnection.signTransactionsURL([transaction], ctx.origin)
    ctx.redirect(url);
    // TODO: Need to do something else than wallet redirect for CORS-enabled fetch
});

// TODO: Do contract method call according to mapping returned by web4_routes contract method
// TODO: Use web4_get method in smart contract as catch all if no mapping?
// TODO: Or is mapping enough?
router.get('/(.*)', withNear, async ctx => {
    // TODO: Allow returning different types of content, including references to external stuff like IPFS
    const {
        path,
        query,
        near
    } = ctx; 

    const contractId = process.env.CONTRACT_NAME;

    const parsedQuery = qs.parse(query);
    const methodParams = {
        request: {
            path,
            query: Object.keys(parsedQuery)
                .map(key => ({ [key] : parsedQuery[key].length ? parsedQuery[key] : [parsedQuery[key]] }))
                .reduce((a, b) => ({...a, ...b}), {})
        }
    };

    const account = await near.account(contractId);
    const res = await account.viewFunction(contractId, 'web4_get', methodParams);
    const { contentType, body } = res;
    ctx.type = contentType;
    ctx.body = Buffer.from(body, 'base64');
});

// TODO: submit transaction mapping path to method name
router.post('/(.*)', ctx => {
    ctx.body = ctx.path;
});


// TODO: Need to query smart contract for rewrites config



app
    .use(async (ctx, next) => {
        console.log(ctx.method, ctx.path);
        await next();
    })
    .use(router.routes())
    .use(router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT);
console.log('Listening on http://localhost:%d/', PORT);
