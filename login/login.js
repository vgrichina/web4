import Cookies from 'js-cookie';
import qs from 'querystring';
import { HereWallet } from "@here-wallet/core";
import { MeteorWallet } from "@meteorwallet/sdk";
import { connect, KeyPair } from "near-api-js";
import { BrowserLocalStorageKeyStore } from 'near-api-js/lib/key_stores';
const { Transaction, functionCall } = require('near-api-js/lib/transaction');
const { PublicKey } = require('near-api-js/lib/utils');

import { signInURL, signTransactionsURL } from "../util/web-wallet-api";

import hereIcon from './icons/here';
import nearIcon from './icons/near';
import myNearIcon from './icons/my-near';
import meteorIcon from './icons/meteor';

async function signInHereWallet({ contractId, callbackUrl }) {
    const here = new HereWallet()
    const accountId = await here.signIn({ contractId });
    console.log(`Hello ${accountId}!`);
    Cookies.set('web4_account_id', accountId);
    Cookies.set('web4_private_key', (await here.authStorage.getKey(here.connection.networkId, accountId)).toString());

    window.location.href = callbackUrl;
}

async function sendTransactionHereWallet({
    receiverId,
    actions,
    callbackUrl
}) {
    const here = new HereWallet()
    const signerId = Cookies.get('web4_account_id');
    try {
        await here.signAndSendTransaction({
            signerId,
            receiverId,
            actions: actions.map(({ functionCall, ...action }) => {
                if (!functionCall) {
                    console.error('Cannot convert action', action);
                    throw new Error('Only functionCall actions are supported');
                }

                return {
                    type: "FunctionCall",
                    params: {
                        methodName: functionCall.methodName,
                        args: functionCall.args,
                        gas: functionCall.gas.toString(),
                        deposit: functionCall.deposit.toString(),
                    }
                };
            })
        });
    } catch (e) {
        console.error(e);
        throw e;
    }
    console.log('Transaction sent');

    // TODO: Check response above?

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
    localStorage.setItem('web4_wallet_url', walletUrl);

    callbackUrl = new URL(
        `/web4/login/complete?${qs.stringify({ web4_callback_url: callbackUrl })}`,
        window.location.href).href;
    const url = signInURL({
        walletUrl,
        contractId,
        publicKey: keyPair.getPublicKey().toString(),
        successUrl: callbackUrl,
        failureUrl: callbackUrl
    });

    window.location.href = url;
}

async function sendTransactionNEARWallet({
    receiverId,
    actions,
    callbackUrl,
}) {
    const walletUrl = localStorage.getItem('web4_wallet_url');
    const signerId = Cookies.get('web4_account_id');

    // NOTE: publicKey, nonce, blockHash keys are faked as reconstructed by wallet
    const transaction = new Transaction({
        signerId,
        publicKey: new PublicKey({ type: 0, data: Buffer.from(new Array(32))}),
        nonce: 0,
        receiverId,
        actions,
        blockHash: Buffer.from(new Array(32))
    });
    const url = signTransactionsURL({
        walletUrl,
        transactions: [transaction],
        callbackUrl
    });

    window.location.href = url;
}

async function createMeteorWallet() {
    const keyStore = new BrowserLocalStorageKeyStore(window.localStorage, "_meteor_wallet");

    const near = await connect({
        keyStore,
        // TODO: Propagate this from config
        networkId: "mainnet",
        nodeUrl: "https://rpc.mainnet.near.org",
        // headers: {},
    });

    return new MeteorWallet({ near, appKeyPrefix: "near_app" });
}

async function signInMeteorWallet({ contractId, callbackUrl }) {
    const keyPair = KeyPair.fromRandom('ed25519');
    Cookies.set('web4_account_id');
    Cookies.set('web4_private_key', keyPair.toString());

    const wallet = await createMeteorWallet();

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

    window.location.href = callbackUrl;
}

async function sendTransactionMeteorWallet({
    receiverId,
    actions,
    callbackUrl
}) {
    const wallet = await createMeteorWallet();
    const account = wallet.account();
    // TODO: check if account matches the one in cookies?

    const response = await account["signAndSendTransaction_direct"]({
        receiverId,
        actions
    });
    // TODO: Check response somehow?

    window.location.href = callbackUrl;
}

function createTransactionRequest({
    contractId,
    methodName,
    argsBase64,
    gas,
    deposit,
    callbackUrl
}) {
    return {
        receiverId: contractId,
        actions: [
            functionCall(methodName, Buffer.from(argsBase64, 'base64'), gas, deposit)
        ],
        callbackUrl
    };
}

window.wallets = {
    here: {
        signIn: signInHereWallet,
        sendTransaction: sendTransactionHereWallet,
        name: 'HERE Wallet',
        iconUrl: hereIcon
    },
    near: {
        signIn: signInNEARWallet,
        sendTransaction: sendTransactionNEARWallet,
        name: 'NEAR Wallet',
        iconUrl: nearIcon
    },
    mynearwallet: {
        signIn: ({ ...args }) => signInNEARWallet({ ...args, walletUrl: 'https://app.mynearwallet.com' }),
        sendTransaction: sendTransactionNEARWallet,
        name: 'MyNearWallet',
        iconUrl: myNearIcon
    },
    meteor: {
        signIn: signInMeteorWallet,
        sendTransaction: sendTransactionMeteorWallet,
        name: 'Meteor Wallet',
        iconUrl: meteorIcon
    }
};

window.createTransactionRequest = createTransactionRequest;