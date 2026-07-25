# user-web-client

Consumer service (pacticipant `UserWebClient`) for the Pact contract testing
example. This is one half of a two-repo pair — the provider lives in a
separate [`user-service`](../user-service) repo. Splitting them keeps each
service's git history, versioning, and CI pipeline independent, so a
provider-only change doesn't force a version bump or re-test on the consumer
(and vice versa).

## Layout

```
user-web-client/
├── src/users-client.js               real consumer HTTP client
├── tests/users-client.pact.test.js   generates the contract
├── pact.config.js                    pacticipant names (must match the provider's copy)
├── pacts/UserWebClient-UserService.json   example generated contract
├── docker-compose.yml                local Pact Broker (standalone use)
└── package.json
```

## How it fits with the provider

1. **This project's test** runs the real `UserApiClient` against a Pact mock
   server (no real network, no real provider). Every request/response pair
   it defines gets written to a **pact file** — a JSON contract — in `pacts/`.
2. That pact file is published to a **Pact Broker**, a shared server both
   this repo and `user-service` talk to.
3. The **provider's own test** (in the `user-service` repo) downloads the
   contract from the broker, replays each recorded request against the real
   provider code, and asserts the response matches what this consumer
   expects.
4. `can-i-deploy` checks the broker before a deploy: "has this exact
   consumer version been verified against every provider version currently
   in production?" If not, the deploy is blocked.

Because each service now has its own git history, `$(git rev-parse --short HEAD)`
in the scripts below is an honest version for *this* pacticipant only — no
more scoping `git log` to specific file paths to work around a shared repo.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in real values if using a shared/hosted broker
npm test                # runs the consumer test, writes pacts/UserWebClient-UserService.json
```

## Using a local Pact Broker

The `docker-compose.yml` here spins up a broker for exercising this project
standalone. If you're working across both `user-web-client` and
`user-service` at once, run only one broker (either repo's `docker-compose.yml`
works — they're identical) and point both projects' `.env` at it via
`PACT_BROKER_BASE_URL`.

```bash
npm run broker:up      # start broker at http://localhost:9292 (pact_broker/pact_broker)
npm test                # generate the pact
npm run pact:publish    # publish it to the broker
```

## Scripts

| Script | Purpose |
|---|---|
| `test` | Runs the consumer test, generates `pacts/*.json` locally |
| `broker:up` / `broker:down` | Start/stop the local Pact Broker via Docker |
| `pact:publish` | Publishes `pacts/` to the broker, versioned by git commit/branch |
| `pact:can-i-deploy` | Checks if the current `UserWebClient` version is safe to deploy |
| `pact:record-deployment` | Records `UserWebClient`'s deploy to `production` |

All `pact:*` scripts read `PACT_BROKER_BASE_URL` / `PACT_BROKER_USERNAME` /
`PACT_BROKER_PASSWORD` from `.env`, defaulting to the local broker — override
them to target a hosted broker (e.g. PactFlow, which uses `--broker-token`
instead of username/password).

### Bootstrapping a fresh broker

`can-i-deploy` compares against whatever is already recorded as deployed to
`production`. On a brand-new broker there's nothing to compare against yet,
so the very first check always fails. For that one bootstrap deploy only,
append `--dry-run` (forces exit code 0 while still printing the real
verdict): `npm run pact:can-i-deploy -- --dry-run`. Don't leave `--dry-run`
in permanently — it silently disables the safety check.

Note: `pacts/UserWebClient-UserService.json` is checked in as a worked
example of the contract format — running `npm test` regenerates it from the
actual test, so don't hand-edit it.
