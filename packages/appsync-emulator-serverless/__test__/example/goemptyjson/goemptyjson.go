package main

import (
	"context"
	"github.com/aws/aws-lambda-go/lambda"
)

func Handler(_ context.Context, _ interface {}) (interface{}, error) {

	return struct {

	}{}, nil
}

func main() {
	lambda.Start(Handler)
}