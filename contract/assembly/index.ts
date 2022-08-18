
import { context, ContractPromise, ContractPromiseBatch, logging, storage, u128, util } from 'near-sdk-as'
import { Web4Request, Web4Response, htmlResponse, preloadUrls, bodyUrl, status } from './web4';
import { form, textarea, button } from './html';

function assertOwner(): void {
    // NOTE: Can change this check to alow different owners
    assert(context.sender == context.contractName);
}

const WEB4_STATIC_URL_KEY = 'web4:staticUrl';

// Updates current static content URL in smart contract storage
export function web4_setStaticUrl(url: string): void {
    assertOwner();

    storage.set(WEB4_STATIC_URL_KEY, url);
}

function styledPage(html: string): Web4Response {
    return htmlResponse(`
        <link rel="stylesheet" href="normalize.css">
        <link rel="stylesheet" href="skeleton.css">
        <div class="container">
            ${html}
        </div>
    `);
}

@nearBindgen
class GuestBookMessage {
    sender: string;
    text: string;
    premium: boolean;
}

function messagesHtml(messages: GuestBookMessage[]): string {
    return `
        <h1>Guest Book</h1>
        <table class="u-full-width">
            <thead>
                <tr>
                    <th>Sender</th>
                    <th>Text</th>
                    <th>Premium</th>
                </tr>
            </thead>
            <tbody>
                ${messages.map<string>(message => `
                    <tr>
                        <td>${message.sender}</td>
                        <td>${message.text}</td>
                        <td>${message.premium ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('\n')}
            </tbody>
        </table>
    `;
}

export function web4_get(request: Web4Request): Web4Response {
    if (request.path == '/messages') {
        const getMessagesUrl = '/web4/contract/guest-book.testnet/getMessages';
        // Request preload of dependency URLs
        if (!request.preloads) {
            return preloadUrls([getMessagesUrl]);
        }

        // Parse messages JSON from preloaded response
        const messages = decode<GuestBookMessage[]>(request.preloads.get(getMessagesUrl).body);

        let formOrLoginLink: string;
        if (request.accountId) {
            // Render HTML with form to submit a message
            formOrLoginLink = form({ action: "/web4/contract/guest-book.testnet/addMessage" }, [
                `<input type="hidden" name="web4_callback_url" value="${request.path}">`,
                textarea({ name: "text", className: "u-full-width" }),
                button({ name: "submit" }, ["Post"])
            ]);
        } else {
            // User needs to login
            formOrLoginLink = `
                Please <a href="/web4/login?callback_url=${request.path}">login</a> to post messages.
            `;
        }

        // Render HTML with messages
        return styledPage(messagesHtml(messages) + formOrLoginLink);
    }

    //  Serve content from IPFS
    if (request.path == "/" || request.path.endsWith('.css')) {
        const staticUrl = storage.getString(WEB4_STATIC_URL_KEY);
        if (staticUrl != null) {
            return bodyUrl(`${staticUrl!}${request.path}`);
        }

        // NOTE: ok to return custom response object if needed
        return { status: 404, contentType: 'text/plain',  body: util.stringToBytes('Static content URL not set. Set using web4_setStaticUrl method.') };
    }

    if (request.accountId) {
        // User is logged in, we can welcome them
        return styledPage(`
            Hello to <b>${request.accountId!}</b> from <code>${request.path}</code>.
            <a href="/web4/logout?callback_url=${request.path}">Logout</a>.
        `);
    }

    // By default return 404 Not Found
    return status(404);
}