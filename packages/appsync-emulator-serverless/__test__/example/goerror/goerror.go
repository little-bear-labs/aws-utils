package main

import (
	"context"
	"errors"
	"github.com/aws/aws-lambda-go/lambda"
)

func Handler(_ context.Context, _ interface {}) (interface {}, error) {
	return "", errors.New("error")
}

func main() {
	lambda.Start(Handler)
}