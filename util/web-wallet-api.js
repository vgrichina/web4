const { SCHEMA } = require('near-api-js/lib/transaction');
const { serialize } = require('borsh');

// TODO: Check what is actually optional and improve docs, provide defaults, etc

/**
 * Returns the URL of wallet authentication page with given options.
 * 
 * @param options.walletUrl URL of web wallet to use
 * @param options.contractId contract ID to give access to
 * @param options.successUrl URL to redirect upon success
 * @param options.failureUrl URL to redirect upon failure
 *
 */
function signInURL({ walletUrl, contractId, publicKey, successUrl, failureUrl }) {
    const newUrl = new URL('/login', walletUrl);
    newUrl.searchParams.set('success_url', successUrl);
    newUrl.searchParams.set('failure_url', failureUrl);
    if (contractId) {
        newUrl.searchParams.set('contract_id', contractId);
    }
    if (publicKey) {
        newUrl.searchParams.set('public_key', publicKey);
    }
    return newUrl.toString();
}

function signTransactionsURL({ walletUrl, transactions, callbackUrl }) {
    const newUrl = new URL('sign', walletUrl);

    newUrl.searchParams.set('transactions', transactions
        .map(transaction => serialize(SCHEMA, transaction))
        .map(serialized => Buffer.from(serialized).toString('base64'))
        .join(','));
    newUrl.searchParams.set('callbackUrl', callbackUrl);

    return newUrl.toString();
}

module.exports = { signInURL, signTransactionsURL }