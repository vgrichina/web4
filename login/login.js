import Cookies from 'js-cookie';
import { HereWallet } from "@here-wallet/core";
import { KeyPair } from "near-api-js";

import { signInURL } from "../util/web-wallet-api";

async function signInHereWallet({ contractId }) {
    const here = new HereWallet()
    try {
        const accountId = await here.signIn({ contractId });
        console.log(`Hello ${accountId}!`);
        Cookies.set('web4_account_id', accountId);
        Cookies.set('web4_private_key', (await here.authStorage.getKey(here.connection.networkId, accountId)).toString());

        // NOTE: CALLBACK_URL set in login.html
        window.location.href = CALLBACK_URL;
    } catch (e) {
        console.error(e);
    }
}

async function signInNEARWallet({
    walletUrl,
    contractId
}) {
    const keyPair = KeyPair.fromRandom('ed25519');
    Cookies.set('web4_account_id');
    Cookies.set('web4_private_key', keyPair.toString());

    window.location.href = signInURL({
        walletUrl,
        contractId,
        publicKey: keyPair.getPublicKey().toString(),
        successUrl: CALLBACK_URL,
        failureUrl: CALLBACK_URL
    });
}

window.signInHereWallet = signInHereWallet;
window.signInNEARWallet = signInNEARWallet;