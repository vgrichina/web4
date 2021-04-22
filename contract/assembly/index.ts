
import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128, util } from 'near-sdk-as'

@nearBindgen
class Web4Request {
    path: string;
    params: Map<string, string>;
    query: Map<string, Array<string>>;
}

@nearBindgen
class Web4Response {
    contentType: string;
    body: Uint8Array;
}

function htmlResponse(text: string): Web4Response {
    return { contentType: 'text/html; charset=UTF-8', body: util.stringToBytes(text) };
}

export function web4_get(request: Web4Request): Web4Response {
    if (request.path == '/test') {
        return htmlResponse(`
            <form action="/web4/contract/guest-book.testnet/addMessage" method="post">
                <textarea name="text"></textarea>
                <button name="submit">Post</button>
            </form>
        `);
    if (request.accountId) {
        return htmlResponse('Hello to <b>' +  request.accountId! + '</b> from <code>' + request.path + '</code>');
    }

    return htmlResponse('Hello from <b>' + request.path + '</b>');
}