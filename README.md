
# web4

Web4 is a new way to distribute decentralized apps.
You only need to deploy one smart contract using WebAssembly to host your app HTTP backend,
static resources and blockchain logic.

## How it works?

There is an HTTP gateway to NEAR blockchain which allows smart contract to handle arbitrary GET requests.
Every smart contract on NEAR also gets corresponding API endpoint which can be accessed through regular HTTP requests.

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
}
```

### Loading data

You can load any required data in `web4_get` by returning list of URLs to preload in `preloadUrls` field.

E.g. contract above preloads `/web4/contract/guest-book.testnet/getMessages`. This class `getMessages` view method on `guest-book.testnet` contract.

After data is preloaded `web4_get` gets called again with loaded data injected into `preloads`.

### Posting transactions

You can post transaction by making a POST request to corresponding URL.

E.g contract above preloads has form that gets posted to `/web4/contract/guest-book.testnet/addMessage` URL. This URL submits transacion which calls `addMessage` method on `guest-book.testnet` contract.

Note that both JSON and form data are supported. When transaction is processed by server user gets redirected to wallet for signing this transaction.

In future there is a plan to allow sending app-specific key as a cookie to sign limited subset of transactions without confirmation in wallet.

## Rust support

Check out [sample web4 project made with Rust](https://github.com/frol/near-web4-demo).

# near.page

You can access your deployed smart contract on https://near.page. This is hosted web4 gateway provided to all `.near` accounts. For now it's free, but in future you might have to pay depending on how much traffic you get.

Every contract gets corresponding domain, e.g. check out https://web4.near.page rendered by `web4.near` contract.

# testnet.page

This works same as `near.page` but for contracts deployed on testnet. Every `account.testnet` gets corresponding `account.testnet.page` domain.

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
    - [ ] Load content from ArWeave URLs
    - [ ] Route configuration for better caching, etc
- Access NEAR
    - [x] Access view calls via GET requests
    - [ ] Access view calls via POST requests
    - [x] Post transactions with POST through wallet redirect
    - [ ] Polish login and transaction flow with wallet
- Decentralization
    - [x] Standalone server to run
    - [ ] .near domain support through hosts file, local certificate authority, etc
- Prepare for wider use
    - [ ] Publish standalone package runnable with `npx`
    - [ ] Tests
    - [ ] Documentation
    - [ ] Landing page
    - [ ] Examples on different languages
    - [ ] More efficient binary-based API
    - [ ] Custom domain support
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
