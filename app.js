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


router.get('/web4/:contractId/:methodName', withNear, async ctx => {
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
