
import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128, util } from 'near-sdk-as'

@nearBindgen
class Web4Request {
    accountId: string | null;
    path: string;
    params: Map<string, string>;
    query: Map<string, Array<string>>;
    preloads: Map<string, Web4Response>;
}

@nearBindgen
class Web4Response {
    contentType: string;
    body: Uint8Array;
    preloadUrls: string[] = [];
}

class HtmlAttributes {
    id: string | null;
    name: string | null;
    class: string | null;
    style: string | null;

    toString(): string {
        let result = "";
        if (this.id) {
            result += "id=";
            result += this.id!;
        }
        if (this.name) {
            result += "name=";
            result += this.name!;
        }
        if (this.class) {
            result += "class=";
            result += this.class!;
        }
        if (this.style) {
            result += "style=";
            result += this.style!;
        }
        return result;
    }
}

class HtmlFormAttributes extends HtmlAttributes {
    action: string | null;
    method: string = "POST";

    toString(): string {
        let result = super.toString();
        if (this.action) {
            result += "action=";
            result += this.action!;
        }
        if (this.method) {
            result += "method=";
            result += this.method;
        }
        return result;
    }
}

function form(attrs: HtmlFormAttributes, content: string[] | null = null): string {
    return '<form ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</form>';
}

function textarea(attrs: HtmlAttributes, content: string[] | null = null): string {
    return '<textarea ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</textarea>';
}

function button(attrs: HtmlAttributes, content: string[] | null = null): string {
    return '<button ' + attrs.toString() + '>' + (content ? content.join('\n') : '') + '</button>';
}

function htmlResponse(text: string): Web4Response {
    return { contentType: 'text/html; charset=UTF-8', body: util.stringToBytes(text) };
}

function preloadUrls(urls: string[]): Web4Response {
    return { preloadUrls: urls };
}

export function web4_get(request: Web4Request): Web4Response {
    if (request.path == '/test') {
        return htmlResponse(form({ action: "/web4/contract/guest-book.testnet/addMessage" }, [
            textarea({ name: "text" }),
            button({ name: "submit" }, ["Post"])
        ]));
    }

    if (request.path == '/messages') {
        const getMessagesUrl = '/web4/contract/guest-book.testnet/getMessages';
        if (!request.preloads) {
            return preloadUrls([getMessagesUrl]);
        }
        logging.log('getMessagesUrl ' + getMessagesUrl);
        logging.log('>>> ' + request.preloads.keys().join(', '));

        return htmlResponse('messages: ' + util.bytesToString(request.preloads.get(getMessagesUrl).body)!);
    }

    if (request.accountId) {
        return htmlResponse('Hello to <b>' +  request.accountId! + '</b> from <code>' + request.path + '</code>');
    }

    return htmlResponse('Hello from <b>' + request.path + '</b>');
}