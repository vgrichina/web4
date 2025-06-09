const CONTRACT_NAME = process.env.CONTRACT_NAME;

function getConfig(env) {
    switch (env) {

    case 'production':
    case 'mainnet':
        return {
            networkId: 'mainnet',
            nodeUrl: process.env.NODE_URL || 'https://rpc.mainnet.near.org',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            contractName: CONTRACT_NAME,
            walletUrl: 'https://wallet.near.org',
            helperUrl: 'https://helper.mainnet.near.org',
            helperAccount: 'near',
            explorerUrl: 'https://explorer.mainnet.near.org',
        };
    case 'development':
    case 'testnet':
        return {
            networkId: 'testnet',
            nodeUrl: process.env.NODE_URL || 'https://rpc.testnet.near.org',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            contractName: CONTRACT_NAME,
            walletUrl: 'https://wallet.testnet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            helperAccount: 'testnet',
            explorerUrl: 'https://explorer.testnet.near.org',
        };
    case 'betanet':
        return {
            networkId: 'betanet',
            nodeUrl: process.env.NODE_URL || 'https://rpc.betanet.near.org',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            contractName: CONTRACT_NAME,
            walletUrl: 'https://wallet.betanet.near.org',
            helperUrl: 'https://helper.betanet.near.org',
            helperAccount: 'betanet',
            explorerUrl: 'https://explorer.betanet.near.org',
        };
    case 'local':
        return {
            networkId: 'local',
            nodeUrl: process.env.NODE_URL || 'http://localhost:3030',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            keyPath: `${process.env.HOME}/.near/validator_key.json`,
            walletUrl: 'http://localhost:4000/wallet',
            contractName: CONTRACT_NAME,
        };
    case 'test':
    case 'ci':
        return {
            networkId: 'shared-test',
            nodeUrl: process.env.NODE_URL || 'https://rpc.ci-testnet.near.org',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            contractName: CONTRACT_NAME,
            masterAccount: 'test.near',
        };
    case 'ci-betanet':
        return {
            networkId: 'shared-test-staging',
            nodeUrl: process.env.NODE_URL || 'https://rpc.ci-betanet.near.org',
            headers: process.env.NEAR_AUTH_TOKEN ? { 'Authorization': process.env.NEAR_AUTH_TOKEN } : {},
            contractName: CONTRACT_NAME,
            masterAccount: 'test.near',
        };
    default:
        throw Error(`Unconfigured environment '${env}'. Can be configured in src/config.js.`);
    }
}

module.exports = getConfig;
