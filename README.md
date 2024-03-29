# Keycard API

This API is responsible for managing keys and counts for all snapshot APIs

## Limits

| Tier | Id | Max Requests (hub) | Max Requests (score-api)
| --- | --- | --- | --- |
| Free | 0 | 2M | 2M |
| Pro | 1 | 5M | 2M |
| Extra | 2 | 4M | 2M |

Make sure to update limits in `src/config.json`

## Getting Started (Local Development)

This API depends on a couple of services:

- Node.js (>= v16.0.0)
- MySQL (v8.0)

### Docker

You can use the docker-compose service to start one up quickly with:

```sh
docker compose up 
# or docker-compose up --build if you want to rebuild the image (will run yarn install and sql from seed.sql)
# this will start mysql on port 3306
# and the api on port 3007
```

### Local

To get start, first install all dependencies with:

```sh
yarn
```

Next, make a copy of `.env.example` and rename it as `.env`. Then update the credentials in the file to the correct values for your
local setup.

> Note: If using docker compose to start dependencies then the default .env.example value should be okay as it is.

Finally, to run the service you do:

```sh
yarn dev
```

This should start the service to be listening on port 3007.

## Using the API

### get_keys

```sh
curl --location 'https://keycard.snapshot.org/' \
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
curl --location 'https://keycard.snapshot.org/' \
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
- Go to <https://app.mycrypto.com/sign-message> and connect your wallet (whitelisted `owner` address)
- Sign the message with keyword `generateKey`.
- Copy the signature and use it in the `sig` param.

```sh
curl --location 'https://keycard.snapshot.org/' \
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

### whitelist

This method is used by laser to whitelist new address

```sh
curl --location 'https://keycard.snapshot.org/' \
--header 'accept: application/json' \
--header 'content-type: application/json' \
--header 'secret: <APP_SECRET>' \
--data '{
    "jsonrpc": "2.0",
    "method": "whitelist",
    "params": {
        "owner": "<OWNER_ADDRESS>",
        "name": "<NAME>"
    },
    "id": "123456789"
}'
```

## Test

Run all tests with 

```bash 
yarn test # Will also generate test coverage
# You can also run only E2E tests with: yarn test:e2e
```

E2E tests require a dedicated MySQL test database, named `keycard_test`, with the same schema as defined in `src/helpers/schema.sql`.
Test configuration are defined in `test/.env.test`
