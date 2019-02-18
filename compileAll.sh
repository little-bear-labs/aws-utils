#!/bin/bash

# This makes sure we compile for linux (used inside the SAM docker containers)
# which won't happen if we are running this script from a Mac terminal.
export GOOS=linux

pushd packages/appsync-emulator-serverless/__test__/example/
pushd gocomposedjson && go build gocomposedjson.go && popd
pushd goemptyjson && go build goemptyjson.go && popd
pushd goerror && go build goerror.go && popd
pushd gographql && go build gographql.go && popd
popd
