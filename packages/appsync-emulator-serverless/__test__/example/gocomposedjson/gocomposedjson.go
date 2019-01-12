package main

import (
	"context"
	"github.com/aws/aws-lambda-go/lambda"
)

func Handler(_ context.Context, _ interface {}) (interface {}, error) {
	ret := map[string]int{}

	ret["a"] = 1
	ret["b"] = 2
	ret["c"] = 3

	return ret, nil
}

func main() {
	lambda.Start(Handler)
}