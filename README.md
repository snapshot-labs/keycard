# Keycard API

This API is responsible for managing keys and counts for all snapshot APIs

## Getting Started (Local Development)

This API depends on a couple of services:

- Node.js (>= v16.0.0)
- MySQL (v8.0)

To get start, first install all dependencies with:

```sh
yarn

```

Next, you need to have a MySQL server running and accessible. You can use the docker-compose service to start one up quickly with:

```sh
docker compose up mysql # this will start mysql on port 3306
```

Next, make a copy of `.env.example` and rename it as `.env`. Then update the credentials in the file to the correct values for your
local setup.

> Note: If using docker compose to start dependencies then the default .env.example value should be okay as it is.

Finally, to run the service you do:

```sh
yarn dev
```

This should start the service to be listening on port 3002.

## Getting Started (Docker)

To run the service in a docker container, you can use the docker-compose file in the root of the repo. To start the service, run:

```sh
docker compose up
```

This will start the service listening on port 3002 and all necessary dependencies.

## Using the API

### get_keys

```sh
curl --location 'http://localhost:3007/' \
--header 'accept: application/json' \
--header 'content-type: application/json' \
--header 'secret: <APP_SECRET>' \
--data '{
    "jsonrpc": "2.0",
    "method": "get_keys",
    "params": {
        "app": "snapshot-hub"
    },
    "id": "123456789"
}'
```

### log_req

```sh
curl --location 'http://localhost:3007/' \
--header 'accept: application/json' \
--header 'content-type: application/json' \
--header 'secret: <APP_SECRET>' \
--data '{
    "jsonrpc": "2.0",
    "method": "log_req",
    "params": {
        "key": "<API_KEY>",
        "app": "snapshot-hub"
    },
    "id": "123456789"
}'
```

### generate_key

- Make sure to whitelist the `owner` and `name` in the `keys` table before generating a key.
- Go to <https://app.mycrypto.com/sign-message> and sign the message `generateKey` with the `owner` address.
- copy the signature and use it in the `sig` param.

```sh
curl --location 'http://localhost:3007/' \
--header 'accept: application/json' \
--header 'content-type: application/json' \
--data '{
    "jsonrpc": "2.0",
    "method": "generate_key",
    "params": {
        "sig": "<SIGNATURE>"
    },
    "id": "123456789"
}'
```
