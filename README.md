[![Coverage Status](https://coveralls.io/repos/github/vgrichina/web4/badge.svg?branch=main)](https://coveralls.io/github/vgrichina/web4?branch=main)

# web4

## Table of Contents
- [TL;DR](#tldr)
- [What is web4?](#what-is-web4)
- [How it works?](#how-it-works)
  - [Authentication](#authentication)
- [Known web4 sites](#known-web4-sites)
- [Useful tools](#useful-tools)
- [Example contract](#example-contract-in-assemblyscript)
  - [Request](#request)
  - [Response](#response)
  - [Loading data](#loading-data)
  - [Posting transactions](#posting-transactions)
  - [Caching considerations](#caching-considerations)
- [Rust support](#rust-support)
- [Deployment](#deployment)
  - [near.page](#nearpage)
  - [testnet.page](#testnetpage)
- [Running locally](#running-locally)
- [FAQ](#frequently-asked-questions)
- [Priorities](#priorities)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## TL;DR

* Manage website frontend in smart contract
* Every `.near` account receives a subdomain under [https://near.page](https://near.page)
    * E.g. `thewiki.near` serves [https://thewiki.near.page](https://thewiki.near.page)
* Use IPFS with Filecoin to host larger files

Quick Start:
```bash
# Create a simple website
mkdir my-web4-site && cd my-web4-site
echo '<h1>Hello Web4!</h1>' > index.html

# Deploy to your account
npx web4-deploy . --accountId your-account.near
```

Your site will be live at `https://your-account.near.page` 🎉

## What is web4?

- Decentralised ownership and hosting
- Content permanence by default, no more expired links
- Offline friendly
- Web presence controlled by user
- Interactive mobile apps linked together as websites, no appstores

## How it works?

You only need to deploy single smart contract using WebAssembly to host your app HTTP backend,
static resources and blockchain logic. See [Example contract](#example-contract-in-assemblyscript) or 
[Rust support](#rust-support) for implementation details.

There is an [HTTP gateway](https://github.com/vgrichina/web4) to NEAR blockchain which allows smart contract to handle arbitrary GET requests.

Every smart contract on NEAR also gets corresponding API endpoint which can be accessed through regular HTTP requests.

### Authentication

Web4 provides simplified authentication flow:

- Login via `/web4/login` endpoint
- Logout via `/web4/logout` endpoint 
- Current account ID is available via `web4_account_id` cookie
- App-specific private key, if used, is stored in `web4_private_key` cookie
- Transactions can be submitted via POST requests to `/web4/contract/{contract_id}/{method_name}`

Example usage in JavaScript:

```javascript
// Login
window.location.href = '/web4/login'

// Check if user is logged in
const accountId = Cookies.get('web4_account_id');

// Logout
window.location.href = '/web4/logout'

// Submit transaction
await fetch('/web4/contract/example.near/someMethod', {
    method: 'POST',
    body: JSON.stringify({ param1: 'value1' })
})
```

This allows seamless integration with existing web frameworks while maintaining security through NEAR wallet.

See also:
- [FAQ: How does authentication work?](#how-does-authentication-work-with-web4)
- [FAQ: web4/login vs wallet integration](#whats-the-difference-between-web4login-and-integrating-a-wallet-directly)

## Known web4 sites

Featured sites:
- https://devhub.near.page - NEAR Developer Hub
- https://web4.near.page - Web4 project homepage
- https://treasury-auroralabs.near.page - NEAR Treasury DAOs
- https://svelt.near.page - Svelte starter template
- https://awesomeweb4.near.page - Web4 app catalog
- https://thewiki.near.page - Decentralized wiki

Community sites:
- https://slimebook.near.page
- https://lands.near.page
- https://zavodil.near.page
- https://psalomo.near.page
- https://oracle-prices.near.page
- https://orangejoe.near.page
- https://orderly.near.page
- https://theegg.near.page
- https://twelvetone.near.page
- https://sotg.near.page
- https://pcards.near.page
- https://aclot.near.page
- https://wlog.near.page
- https://1chess.near.page
- https://vlad.near.page

See more examples at https://awesomeweb4.near.page

## Useful tools

- HTTP gateway https://github.com/vgrichina/web4
- High performance RPC https://github.com/vgrichina/fast-near
- Deploy tool https://github.com/vgrichina/web4-deploy
- Rust starter projects:
  - https://github.com/zavodil/near-web4-contract
  - https://github.com/frol/near-web4-demo
- Self-hosted Linktree  https://github.com/vgrichina/web4-littlelink
- Svelte starter http://svelt.near.page
- Web4 app catalog https://awesomeweb4.near.page

## Example contract (in AssemblyScript)

```ts
export function web4_get(request: Web4Request): Web4Response {
    if (request.path == '/test') {
        // Render HTML with form to submit a message
        return htmlResponse(form({ action: "/web4/contract/guest-book.testnet/addMessage" }, [
            textarea({ name: "text" }),
            button({ name: "submit" }, ["Post"])
        ]));
    }


    if (request.path == '/messages') {
        const getMessagesUrl = '/web4/contract/guest-book.testnet/getMessages';
        // Request preload of dependency URLs
        if (!request.preloads) {
            return preloadUrls([getMessagesUrl]);
        }

        // Render HTML with messages
        return htmlResponse('messages: ' + util.bytesToString(request.preloads.get(getMessagesUrl).body)!);
    }

    if (request.accountId) {
        // User is logged in, we can welcome them
        return htmlResponse('Hello to <b>' +  request.accountId! + '</b> from <code>' + request.path + '</code>');
    }

    // Demonstrate serving content from IPFS
    if (request.path == "/") {
        return bodyUrl('ipfs://bafybeib72whzo2qiore4q6sumdteh6akewakrvukvqmx4n6kk7nwzinpaa/')
    }

    // By default return 404 Not Found
    return status(404);
}

```

Basically smart contract just needs to implement `web4_get` method to take in and return data in specific format.

### Request

```ts
@nearBindgen
class Web4Request {
    accountId: string | null;
    path: string;
    params: Map<string, string>;
    query: Map<string, Array<string>>;
    preloads: Map<string, Web4Response>;
}
```

### Response

```ts
@nearBindgen
class Web4Response {
    contentType: string;
    status: u32;
    body: Uint8Array;
    bodyUrl: string;
    preloadUrls: string[] = [];
    cacheControl: string;
}
```

### Loading data

You can load any required data in `web4_get` by returning list of URLs to preload in `preloadUrls` field.

E.g. contract above preloads `/web4/contract/guest-book.testnet/getMessages`. This class `getMessages` view method on `guest-book.testnet` contract.

After data is preloaded `web4_get` gets called again with loaded data injected into `preloads`.

### Posting transactions

You can post transaction by making a POST request to corresponding URL.

E.g contract above preloads has form that gets posted to `/web4/contract/guest-book.testnet/addMessage` URL. This URL submits transaction which calls `addMessage` method on `guest-book.testnet` contract.

Note that both JSON and form data are supported. When transaction is processed by server user gets redirected to wallet for signing this transaction.

In future there is a plan to allow sending app-specific key as a cookie to sign limited subset of transactions without confirmation in wallet.

### Caching considerations

By default all HTML responses can be cached for 1 minute (assumed dynamic content). 
All images, videos, audio and CSS can be cached for 1 day (assumed static content).

You can override this by setting `cacheControl` field in response.

It's not recommended to cache content for too long as then it not going to be hot on IPFS gateway.

See also:
- [Rust support](#rust-support)
- [Known web4 sites](#known-web4-sites) for real-world examples

## Rust support

Check out [sample web4 project made with Rust](https://github.com/frol/near-web4-demo).

# near.page

You can access your deployed smart contract on https://near.page. This is hosted web4 gateway provided to all `.near` accounts. For now it's free, but in future you might have to pay depending on how much traffic you get.

Every contract gets corresponding domain, e.g. check out https://web4.near.page rendered by `web4.near` contract.

# testnet.page

This works same as `near.page` but for contracts deployed on testnet. Every `account.testnet` gets corresponding `account.testnet.page` domain.

# Running locally

1. Install [mkcert](https://mkcert.dev/).
2. Install local certificate authority (this allows browser to trust self-signed certificates):
    ```bash
    mkcert -install
    ```
3. Create `*.near.page` SSL certificate:
    ```bash
    mkcert "*.near.page"
    ```
3. Run `web4` man-in-the-middle proxy locally:
    ```bash
    IPFS_GATEWAY_URL=https://ipfs.near.social NODE_ENV=mainnet WEB4_KEY_FILE=./_wildcard.near.page-key.pem WEB4_CERT_FILE=./_wildcard.near.page.pem npx web4-near
    ```
4. Setup browser to use [automatic proxy configuration file](https://developer.mozilla.org/en-US/docs/Web/HTTP/Proxy_servers_and_tunneling/Proxy_Auto-Configuration_PAC_file) at `http://localhost:8080/` or to use `localhost:8080` as an HTTPS proxy server. 

See also:
- [FAQ: How can I access my local app bundle?](#how-can-i-access-my-local-app-bundle)
- [near.page](#nearpage) and [testnet.page](#testnetpage) for production deployment

## Environment variables

- `NODE_ENV` - `mainnet` or `testnet` to select network ID to use with NEAR config and key store
- `IPFS_GATEWAY_URL` - URL of IPFS gateway to use for `ipfs://` URLs
- `WEB4_KEY_FILE` - path to SSL key file
- `WEB4_CERT_FILE` - path to SSL certificate file
- `PORT` - port to listen on (default: `3000`)
- `PROXY_PORT` - port to listen on for proxy requests (default: `8080`). HTTPS MITM proxy is run on this port when `WEB4_KEY_FILE` and `WEB4_CERT_FILE` are provided.
- `FAST_NEAR_URL` - URL of [fast-near](https://github.com/vgrichina/fast-near) RPC server to use for NEAR API. Overrides NEAR RPC config selected by `NODE_ENV`.

# Frequently Asked Questions

## What are the key advantages of web4?
* Censorship resistance through decentralized blockchain hosting
* Low cost - only pay for transactions
* Permanent availability via NEAR blockchain

## How does authentication work with web4?
Authentication is handled through `/web4/login` and `/web4/logout` endpoints. Account information is stored in cookies, with the current account ID available in `web4_account_id` cookie. Example usage:

```javascript
// Login
window.location.href = '/web4/login'
// Get current user
const accountId = Cookies.get('web4_account_id')
```

See the Authentication section above for more details.

## What's the difference between web4/login and integrating a wallet directly?
Using web4's authentication endpoints allows your application to remain wallet-agnostic. Your app will continue working without modifications as wallet implementations change. See [wallet integration guide](https://docs.near.org/tools/wallet-selector) for comparison.

## How do I handle large files?
NEARFS is the recommended way to store large files on web4. Deploy files using:
```bash
npx web4-deploy --nearfs ./path/to/files
```
See [web4-deploy docs](https://github.com/vgrichina/web4-deploy#readme) for more options.

## Can I use web4 with Rust?
Yes! Start with the [Rust starter project](https://github.com/zavodil/near-web4-contract):
```bash
git clone https://github.com/zavodil/near-web4-contract
cd near-web4-contract
./build.sh
```

## How do I deploy my web4 site?
Use web4-deploy:
```bash
npx web4-deploy ./dist
```
This uploads files to IPFS/NEARFS and updates your smart contract. See [deployment guide](https://github.com/vgrichina/web4-deploy#readme).

## How can I fetch account state?
Use the web4 RPC endpoint:
```bash
curl https://rpc.web4.near.page/account/your-account.near/state
```

## How can I store NFTs on web4?
Deploy a web4 contract implementing the [NEP-171 standard](https://nomicon.io/Standards/NonFungibleToken/Core). Example:
```bash
git clone https://github.com/near-examples/NFT
cd NFT
yarn deploy
```

## How can I access my local app bundle?
Run local web4 gateway:
```bash
npx web4-near
```
Then access your app at `https://your-account.near.page`

## Can the web4 RPC return different data than direct contract calls?
Yes, if the RPC indexer falls behind the latest blocks. Check indexer status:
```bash
curl https://rpc.web4.near.page/status
```

## How do I deploy to subaccounts?
Subaccounts are not currently supported by web4. Use custom domains instead - see [custom domain setup guide](https://github.com/vgrichina/web4/wiki/Custom-Domains).

# Priorities

This project aims to make trade offs based on these priorities:

- Performance
- Ease of deployment at scale
- Hackability
- Correctness
- Completeness

# Roadmap

- Serve websites
    - [x] Serve arbitrary GET requests
    - [ ] Serve arbitrary POST requests
    - [x] Load content from HTTP URLs
    - [x] Load content from IPFS URLs
    - [x] Load content from [NEARFS](https://github.com/vgrichina/nearfs) URLs
    - [ ] Load content from ArWeave URLs
    - [ ] Route configuration for better caching, etc
- Access NEAR
    - [x] Access view calls via GET requests
    - [ ] Access view calls via POST requests
    - [x] Post transactions with POST through wallet redirect
    - [ ] Polish login and transaction flow with wallet
    - [ ] Support different wallets from wallet-selector
- Decentralization
    - [x] Standalone server to run
    - [x] .near domain support through HTTPS MITM proxy
    - [x] Proxy auto-configuration file
    - [ ] User-friendly installer
    - [ ] Expose IPFS gateway on every .near.page website
    - [ ] Expose fast-near RPC on every .near.page website
- Prepare for wider use
    - [x] Publish standalone package runnable with `npx`
    - [ ] Tests
    - [ ] Documentation
    - [ ] Landing page
    - [ ] Examples on different languages
    - [ ] More efficient binary-based API (`web4_raw_get`)
    - [x] Custom domain support
    - [ ] Abuse report system (token curated registry or smth like that)
    - [ ] Billing
- Future direction
    - [x] Upload to IPFS and pin (see [web4-deploy](https://github.com/vgrichina/web4-deploy))
    - [ ] Upload to ArWeave
    - [ ] Built-in per user statsd, including over http
    - [ ] Pubsub protocol
    - [ ] Direct messages protocol
    - [ ] Indexer API
    - [ ] Private storage
    - [ ] Private messages
    - [ ] Voice API
    - [ ] web4 wallet
    - [ ] App launcher for wallet (pre-selecting necessary account in app)
    - [ ] Instant mobile apps using WebAssembly

# Contributing

We welcome contributions to web4! Here's how you can help:

## Join the Community
Join our [Telegram group](https://t.me/web4near) to discuss ideas, ask questions, and connect with other developers.

## Share Your Examples
We need more example applications, especially:
- Templates for different frameworks (React, Vue, Angular, etc.)
- Apps in different languages (Rust, AssemblyScript, JavaScript)
- Integration examples with various NEAR protocols
- Real-world applications showcasing web4 capabilities

## Development
- Check out [open issues](https://github.com/vgrichina/web4/issues)
- Submit bug reports and feature requests
- Improve documentation
