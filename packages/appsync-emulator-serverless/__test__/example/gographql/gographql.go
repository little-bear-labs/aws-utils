package main

import (
	"context"
	"github.com/aws/aws-lambda-go/lambda"
)

func Handler(_ context.Context, _ interface {}) (interface {}, error) {
	ret := map[string]string{}

	ret["test"] = "yup"

	return ret, nil
}

func main() {
	lambda.Start(Handler)
}