const {
    connect,
    keyStores: { InMemoryKeyStore },
    KeyPair,
    providers: { JsonRpcProvider }
} = require('near-api-js');

const fetch = require('node-fetch');
const qs = require('qs');

const MAX_PRELOAD_HOPS = 5;
const IPFS_GATEWAY_URL = (process.env.IPFS_GATEWAY_URL || 'https://cloudflare-ipfs.com').trim();
const NEARFS_GATEWAY_URL = (process.env.NEARFS_GATEWAY_URL || 'https://ipfs.web4.near.page').trim();

const config = require('./config')(process.env.NEAR_ENV || process.env.NODE_ENV || 'development')

async function withDebug(ctx, next) {
    ctx.debug = require('debug')(`web4:${ctx.host}${ctx.path}?${qs.stringify(ctx.query)}`);

    await next();
}

async function withNear(ctx, next) {
    // TODO: Why no default keyStore?
    const keyStore = new InMemoryKeyStore();
    const near = await connect({...config, keyStore});

    Object.assign(ctx, { config, keyStore, near });

    try {
        await next();
    } catch (e) {
        switch (e.type) {
            case 'AccountDoesNotExist':
                ctx.throw(404, e.message);
            case 'UntypedError':
            default:
                ctx.throw(400, e.message);
        }
    }
}

async function withAccountId(ctx, next) {
    const accountId = ctx.cookies.get('web4_account_id');
    ctx.accountId = accountId;
    await next();
}

async function requireAccountId(ctx, next) {
    if (!ctx.accountId) {
        ctx.redirect('/web4/login');
        return;
    }
    await next();
}

const Koa = require('koa');
const app = new Koa();

const Router = require('koa-router');
const router = new Router();

const getRawBody = require('raw-body');

const FAST_NEAR_URL = process.env.FAST_NEAR_URL;

const callViewFunction = async ({ near }, contractId, methodName, args) => {
    if (FAST_NEAR_URL) {
        const res = await fetch(`${FAST_NEAR_URL}/account/${contractId}/view/${methodName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(args)
        });
        if (!res.ok) {
            throw new Error(await res.text());
        }
        return await res.json();
    }

    const account = await near.account(contractId);
    return await account.viewFunction({ contractId, methodName, args });
}

router.get('/web4/contract/:contractId/:methodName', withNear, async ctx => {
    const {
        params: { contractId, methodName },
        query
    } = ctx;

    const methodParams = Object.keys(query)
        .map(key => key.endsWith('.json')
            ? { [key.replace(/\.json$/, '')]: JSON.parse(query[key]) }
            : { [key] : query[key] })
        .reduce((a, b) => ({...a, ...b}), {});

    ctx.body = await callViewFunction(ctx, contractId, methodName, methodParams);
});

const fs = require('fs/promises');

// TODO: Less hacky templating?
async function renderTemplate(templatePath, params) {
    let result = await fs.readFile(`${__dirname}/${templatePath}`, 'utf8');
    for (key of Object.keys(params)) {
        result = result.replace(`$${key}$`, JSON.stringify(params[key]));
    }
    return result;
}

router.get('/web4/login', withNear, withContractId, async ctx => {
    let {
        contractId,
        query: { web4_callback_url, web4_contract_id }
    } = ctx;

    const callbackUrl = new URL(web4_callback_url || ctx.get('referrer') || '/', ctx.origin).toString();

    ctx.type = 'text/html';
    ctx.body = await renderTemplate('wallet-adapter/login.html', {
        CONTRACT_ID: web4_contract_id || contractId,
        CALLBACK_URL: callbackUrl,
        NETWORK_ID: ctx.near.connection.networkId,
    });
});

router.get('/web4/wallet-adapter.js', async ctx => {
    ctx.type = 'text/javascript';
    ctx.body = await fs.readFile(`${__dirname}/wallet-adapter/dist/wallet-adapter.js`);
});

router.get('/web4/login/complete', async ctx => {
    const { account_id, web4_callback_url } = ctx.query;
    if (account_id) {
        ctx.cookies.set('web4_account_id', account_id, { httpOnly: false });
    }
    if (!web4_callback_url) {
        ctx.throw(400, 'Missing web4_callback_url');
    }

    ctx.redirect(web4_callback_url);
});

router.get('/web4/sign', withAccountId, requireAccountId, async ctx => {
    const {
        query: {
            web4_contract_id,
            web4_method_name,
            web4_args,
            web4_gas,
            web4_deposit,
            web4_callback_url
        }
    } = ctx;

    ctx.type = 'text/html';
    ctx.body = await renderTemplate('wallet-adapter/sign.html', {
        CONTRACT_ID: web4_contract_id,
        METHOD_NAME: web4_method_name,
        ARGS: web4_args,
        GAS: web4_gas,
        DEPOSIT: web4_deposit,
        CALLBACK_URL: web4_callback_url
    });
});

router.get('/web4/logout', async ctx => {
    let {
        query: { web4_callback_url }
    } = ctx;

    ctx.cookies.set('web4_account_id');
    ctx.cookies.set('web4_private_key');

    const callbackUrl = new URL(web4_callback_url || ctx.get('referrer') || '/', ctx.origin).toString();
    ctx.redirect(callbackUrl);
});

const DEFAULT_GAS = '300' + '000000000000';

router.post('/web4/contract/:contractId/:methodName', withNear, withAccountId, requireAccountId, async ctx => {
    // TODO: Accept both json and form submission

    const { accountId, debug } = ctx;

    const appPrivateKey = ctx.cookies.get('web4_private_key');

    const { contractId, methodName } = ctx.params;

    const rawBody = await getRawBody(ctx.req);
    let gas = DEFAULT_GAS;
    let deposit = '0';
    let callbackUrl;
    if (ctx.request.type == 'application/x-www-form-urlencoded') {
        const body = qs.parse(rawBody.toString('utf8'), { allowDots: true });
        args = Object.keys(body)
            .filter(key => !key.startsWith('web4_'))
            .map(key => ({ [key]: body[key] }))
            .reduce((a, b) => ({...a, ...b}), {});
        args = Buffer.from(JSON.stringify(args));
        // TODO: Allow to pass web4_ stuff in headers as well
        if (body.web4_gas) {
            gas = body.web4_gas;
        }
        if (body.web4_deposit) {
            deposit = body.web4_deposit;
        }
        if (body.web4_callback_url) {
            callbackUrl = body.web4_callback_url;
        }
    } else {
        args = rawBody;
    }

    callbackUrl = new URL(callbackUrl || ctx.get('referrer') || '/', ctx.origin).toString()
    debug('callbackUrl', callbackUrl);

    // Check if can be signed without wallet
    if (appPrivateKey && (!deposit || deposit == '0')) {
        debug('Signing locally');
        const keyPair = KeyPair.fromString(appPrivateKey);
        const appKeyStore = new InMemoryKeyStore();
        await appKeyStore.setKey(ctx.near.connection.networkId, accountId, keyPair);

        const near = await connect({ ...ctx.near.config, keyStore: appKeyStore });

        debug('Checking access key', keyPair.getPublicKey().toString());
        try {
            // TODO: Migrate towards fast-near REST API
            const { permission: { FunctionCall }} = await near.connection.provider.query({
                request_type: 'view_access_key',
                account_id: accountId,
                public_key: keyPair.getPublicKey().toString(),
                finality: 'optimistic'
            });
            if (FunctionCall && FunctionCall.receiver_id == contractId) {
                debug('Access key found');
                const account = await near.account(accountId);
                const result = await account.functionCall({ contractId, methodName, args, gas, deposit });
                debug('Result', result);
                // TODO: when used from fetch, etc shouldn't really redirect. Judge based on Accepts header?
                if (ctx.request.type == 'application/x-www-form-urlencoded') {
                    ctx.redirect(callbackUrl);
                    // TODO: Pass transaction hashes, etc to callback?
                } else {
                    const { status } = result;

                    if (status?.SuccessValue !== undefined) {
                        const callResult = Buffer.from(status.SuccessValue, 'base64')
                        debug('Call succeeded with result', callResult);
                        // TODO: Detect content type from returned result
                        ctx.type = 'application/json';
                        ctx.status = 200;
                        ctx.body = callResult;
                        // TODO: Return extra info in headers like tx hash, etc
                        return;
                    }

                    debug('Call failed with result', result);
                    // TODO: Decide what exactly to return
                    ctx.status = 409;
                    ctx.body = result;
                }
                return;
            }
        } catch (e) {
            if (!e.toString().includes('does not exist while viewing')) {
                debug('Error checking access key', e);
                throw e;
            }

            debug('Access key not found, falling back to wallet');
        }
    }

    debug('Signing with wallet');

    const url = `/web4/sign?${
        qs.stringify({
            web4_contract_id: contractId,
            web4_method_name: methodName,
            web4_args: Buffer.from(args).toString('base64'),
            web4_contract_id: contractId,
            web4_gas: gas,
            web4_deposit: deposit,
            web4_callback_url: callbackUrl
        })}`;
    debug('Redirecting to', url);
    ctx.redirect(url);
    // TODO: Need to do something else than wallet redirect for CORS-enabled fetch
});

function contractFromHost(host) {
    if (host.endsWith('.near.page')) {
        return host.replace(/.page$/, '');
    }
    if (host.endsWith('.testnet.page')) {
        return host.replace(/.page$/, '');
    }
}

const dns = require('dns').promises;

async function withContractId(ctx, next) {
    let contractId = contractFromHost(ctx.host);

    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(ctx.host.split(':')[0]);

    if (!contractId && !isLocalhost) {
        for (let host of [ctx.host, `www.${ctx.host}`]) {
            // Try to resolve custom domain CNAME record
            try {
                const addresses = await dns.resolveCname(host);
                const address = addresses.find(contractFromHost);
                if (address) {
                    contractId = contractFromHost(address);
                    break;
                }
            } catch (e) {
                console.log('Error resolving CNAME', ctx.host, e);
                // Ignore
            }
        }
    }

    ctx.contractId = contractId || process.env.CONTRACT_NAME;

    return await next();
}

// TODO: Do contract method call according to mapping returned by web4_routes contract method
// TODO: Use web4_get method in smart contract as catch all if no mapping?
// TODO: Or is mapping enough?
router.get('/(.*)', withNear, withContractId, withAccountId, async ctx => {
    const {
        debug,
        accountId,
        path,
        query
    } = ctx;
    let { contractId } = ctx;

    const methodParams = {
        request: {
            accountId,
            path,
            query: Object.keys(query)
                .map(key => ({ [key] : Array.isArray(query[key]) ? query[key] : [query[key]] }))
                .reduce((a, b) => ({...a, ...b}), {})
        }
    };
    debug('methodParams', methodParams);

    for (let i = 0; i < MAX_PRELOAD_HOPS; i++) {
        debug('hop', i);
        let res;
        try {
            res = await callViewFunction(ctx, contractId, 'web4_get', methodParams);
        } catch (e) {
            // Support hosting web4 contract on subaccount like web4.vlad.near
            // TODO: Cache whether given account needs this
            // TODO: remove nearcore error check after full migration to fast-near
            if (e.message.includes('CompilationError(CodeDoesNotExist')
                || e.message.includes('MethodResolveError(MethodNotFound')
                || e.message.startsWith('codeNotFound')
                || e.message.match(/Account ID .* is invalid/) // NOTE: Looks like NEAR RPC returns this for non-existent contract code
                || e.message.includes('method web4_get not found')) {

                if (i == 0) {
                    contractId = `web4.${contractId}`;
                    continue;
                }
            }

            throw e;
        }

        const { contentType, status, body, bodyUrl, preloadUrls, cacheControl } = res;

        debug('response: %j', { status, contentType, body: !!body, bodyUrl, preloadUrls, cacheControl });

        if (status) {
            ctx.status = status;
            if (!body && !bodyUrl) {
                ctx.body = ctx.message;
                return;
            }
        }

        if (body) {
            ctx.type = contentType
            ctx.body = Buffer.from(body, 'base64');
            if (cacheControl) {
                ctx.set('cache-control', cacheControl);
            }
            return;
        }

        if (bodyUrl) {
            let absoluteUrl = new URL(bodyUrl, ctx.origin).toString();
            debug('Loading', absoluteUrl);

            let urlsToCheck = [absoluteUrl];
            if (absoluteUrl.startsWith('ipfs:')) {
                const { hostname, pathname, search } = new URL(absoluteUrl);
                urlsToCheck = [];
                if (NEARFS_GATEWAY_URL) {
                    urlsToCheck.push(`${NEARFS_GATEWAY_URL}/ipfs/${hostname}${pathname}${search}`);
                }
                urlsToCheck.push(`${IPFS_GATEWAY_URL}/ipfs/${hostname}${pathname}${search}`);
            }

            let res
            for (let url of urlsToCheck) {
                debug('Trying', url);
                res = await fetch(url);
                if (res.status == 200) {
                    break;
                }
            }
            debug('Loaded', absoluteUrl);

            // TODO: Pass through error?
            if (!status) {
                ctx.status = res.status;
            }
            debug('status', ctx.status);

            const needToUncompress = !!res.headers.get('content-encoding');
            debug('needToUncompress', needToUncompress);
            for (let [key, value] of res.headers.entries()) {
                if (needToUncompress && ['content-encoding', 'content-length'].includes(key)) {
                    // NOTE: fetch returns Gunzip stream, so response doesn't get compressed + content length is off
                    // TODO: Figure out how to relay compressed stream instead
                    continue;
                }
                if (key == 'cache-control') {
                    // NOTE: Underlying storage (IPFS) might be immutable, but smart contract can change where it's pointing to
                    continue;
                }
                ctx.set(key, value);
            }
            if (contentType) {
                ctx.type = contentType;
            }
            if (cacheControl) {
                ctx.set('cache-control', cacheControl);
            } else {
                // Set reasonable defaults based on content type
                if (ctx.type.startsWith('image/') || ctx.type.startsWith('font/') ||
                        ctx.type.startsWith('video/') || ctx.type.startsWith('audio/') ||
                        ctx.type === 'application/javascript' || ctx.type === 'text/css' ) {
                    // NOTE: modern web apps typically have these static with a unique URL, so can cache for a long time (1 hour)
                    ctx.set('cache-control', 'public, max-age=3600');
                }
                if (ctx.type === 'text/html') {
                    // NOTE: HTML is typically generated on the fly, so can't cache for too long (1 minute)
                    ctx.set('cache-control', 'public, max-age=60'); // 1 minute
                }
            }
            debug('ctx.type', ctx.type);
            ctx.body = res.body;
            return;
        }

        if (preloadUrls) {
            const preloads = await Promise.all(preloadUrls.map(async url => {
                const absoluteUrl = new URL(url, ctx.origin).toString();
                const res = await fetch(absoluteUrl);
                return [url, {
                    contentType: res.headers.get('content-type'),
                    body: (await res.buffer()).toString('base64')
                }];
            }));
            methodParams.request.preloads = preloads.map(([key, value]) => ({[key] : value}))
                .reduce((a, b) => ({...a, ...b}), {});
            continue;
        }

        break;
    }

    ctx.throw(502, 'too many preloads');
});

// TODO: submit transaction mapping path to method name
router.post('/(.*)', ctx => {
    ctx.body = ctx.path;
});


// TODO: Need to query smart contract for rewrites config

app
    .use(withDebug)
    .use(async (ctx, next) => {
        console.log(ctx.method, ctx.host, ctx.path);
        await next();
    })
    .use(router.routes())
    .use(router.allowedMethods());

module.exports = app;

