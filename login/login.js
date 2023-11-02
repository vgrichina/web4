import Cookies from 'js-cookie';
import { HereWallet } from "@here-wallet/core";
import { MeteorWallet } from "@meteorwallet/sdk";
import { connect, KeyPair } from "near-api-js";
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';

import { signInURL } from "../util/web-wallet-api";

async function signInHereWallet({ contractId }) {
    const here = new HereWallet()
    const accountId = await here.signIn({ contractId });
    console.log(`Hello ${accountId}!`);
    Cookies.set('web4_account_id', accountId);
    Cookies.set('web4_private_key', (await here.authStorage.getKey(here.connection.networkId, accountId)).toString());

    // NOTE: CALLBACK_URL set in login.html
    window.location.href = CALLBACK_URL;
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

async function signInMeteorWallet({ contractId }) {
    const keyPair = KeyPair.fromRandom('ed25519');
    Cookies.set('web4_account_id');
    Cookies.set('web4_private_key', keyPair.toString());

    const keyStore = new BrowserLocalStorageKeyStore(window.localStorage, "_meteor_wallet");

    const near = await connect({
        keyStore,
        // TODO: Propagate this from config
        networkId: "mainnet",
        // headers: {},
    });

    const wallet = new MeteorWallet({ near, appKeyPrefix: "near_app" });

    const { success, payload: { accountId }} = await wallet.requestSignIn({
        contract_id: contractId,
        type: "ALL_METHODS",
        keyPair
    });

    if (!success) {
        console.log('Meteor Wallet sign in failed');
        return;
        // TODO: Check how to handle failure
    }

    Cookies.set('web4_account_id', accountId);
    Cookies.set('web4_private_key', keyPair.toString());

    // NOTE: CALLBACK_URL set in login.html
    window.location.href = CALLBACK_URL;
}

window.signInHereWallet = signInHereWallet;
window.signInNEARWallet = signInNEARWallet;
window.signInMeteorWallet = signInMeteorWallet;