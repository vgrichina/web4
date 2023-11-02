import Cookies from 'js-cookie';
import { HereWallet } from "@here-wallet/core";
import { MeteorWallet } from "@meteorwallet/sdk";
import { connect, KeyPair } from "near-api-js";
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';

import { signInURL } from "../util/web-wallet-api";

async function signInHereWallet({ contractId, callbackUrl }) {
    const here = new HereWallet()
    const accountId = await here.signIn({ contractId });
    console.log(`Hello ${accountId}!`);
    Cookies.set('web4_account_id', accountId);
    Cookies.set('web4_private_key', (await here.authStorage.getKey(here.connection.networkId, accountId)).toString());

    window.location.href = callbackUrl;
}

async function signInNEARWallet({
    walletUrl = 'https://wallet.near.org',
    contractId,
    callbackUrl
}) {
    const keyPair = KeyPair.fromRandom('ed25519');
    Cookies.set('web4_account_id');
    Cookies.set('web4_private_key', keyPair.toString());

    window.location.href = signInURL({
        walletUrl,
        contractId,
        publicKey: keyPair.getPublicKey().toString(),
        successUrl: callbackUrl,
        failureUrl: callbackUrl
    });
}

async function signInMeteorWallet({ contractId, callbackUrl }) {
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

    window.location.href = callbackUrl;
}

window.wallets = {
    here: {
        signIn: signInHereWallet,
        name: 'HERE Wallet'
    },
    near: {
        signIn: signInNEARWallet,
        name: 'NEAR Wallet'
    },
    mynearwallet: {
        signIn: ({ contractId }) => signInNEARWallet({ contractId, walletUrl: 'https://app.mynearwallet.com' }),
        name: 'MyNearWallet'
    },
    meteor: {
        signIn: signInMeteorWallet,
        name: 'Meteor Wallet'
    }
};