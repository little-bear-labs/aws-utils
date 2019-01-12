#!/bin/bash

pushd packages/appsync-emulator-serverless/__test__/example/
pushd gocomposedjson && go build gocomposedjson.go && popd
pushd goemptyjson && go build goemptyjson.go && popd
pushd goerror && go build goerror.go && popd
pushd gographql && go build gographql.go && popd
popd
