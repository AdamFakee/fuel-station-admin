.PHONY: run test lint build

run:
	go run ./cmd/api

test:
	go test -v ./...

lint:
	golangci-lint run

build:
	go build -o bin/api ./cmd/api
