const { connect, keyStores: { InMemoryKeyStore } } = require('near-api-js');

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

router.get('/web4/login');
// TODO: Generate private key, return in cookie and redirect to wallet for login

router.post('/web4/logout');
// TODO: Remove private key cookie (ideally also somehow remove key from account?)

router.post('/web4/contract/:contractId/:methodName', withNear, async ctx => {
    // TODO: Sign transaction with private key and account from cookies

    // TODO: Accept both json and form submission
});

// TODO: Do contract method call according to mapping returned by web4_routes contract method
// TODO: Use web4_get method in smart contract as catch all if no mapping?
// TODO: Or is mapping enough?
router.get('/(.*)', ctx => {
    // TODO: Allow returning different types of content, including references to external stuff like IPFS
    ctx.body = ctx.path;
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
