#!/bin/sh
set -ex

# Start server, using mainnet NEAR RPC
NODE_ENV=mainnet bin/web4 &

# Kill child processes on exit
trap "pkill -SIGINT -P $$" EXIT

# Wait for server to start
sleep 1

# Use curl for basic JSON-RPC tests
curl --fail-with-body http://localhost:3000/ -H 'Host: web4.near.page'
curl --fail-with-body http://localhost:3000/ -H 'Host: vlad.near.page'
curl --fail-with-body http://localhost:3000/ -H 'Host: lands.near.page'
curl --fail-with-body http://localhost:3000/ -H 'Host: new.humanguild.io'
