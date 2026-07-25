// Consumer (UserWebClient) pipeline.
//
// Runs the consumer's Pact test (writes pacts/UserWebClient-UserService.json
// against a Pact mock server, no real provider involved), publishes that
// contract to the Pact Broker, then triggers the provider (UserService)
// pipeline so it re-verifies against what was just published.
pipeline {
    agent {
        docker {
            image 'node:20-bullseye'
            // Socket mount lets this container drive the host's Docker
            // daemon to start docker-compose.yml's Pact Broker (see the
            // "Start Pact Broker" stage below). --network host puts the
            // container on the host's network so it can then reach that
            // broker at localhost:9292 — Linux Docker hosts only, since
            // host networking isn't supported on Docker Desktop.
            // -u root:root overrides the Docker Pipeline plugin's default
            // of running as the Jenkins host user (uid:gid) — that user
            // can't apt-get install the Docker CLI or reliably use the
            // mounted socket, so this stage needs root inside the container.
            args '-v /var/run/docker.sock:/var/run/docker.sock --network host -u root:root'
        }
    }

    // Fires this pipeline on every push to this repo. This is the normal
    // entry point for the pact flow: a consumer change re-publishes the
    // pact and then triggers the provider job below.
    triggers {
        githubPush()
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // Same three credentials as the provider pipeline — must point at
        // the same broker. See Jenkinsfile in the user-service repo.
        // PACT_BROKER_BASE_URL should be http://localhost:9292 to match the
        // broker started by the stage below.
        PACT_BROKER_BASE_URL = credentials('pact-broker-base-url')
        PACT_BROKER_USERNAME = credentials('pact-broker-username')
        PACT_BROKER_PASSWORD = credentials('pact-broker-password')

        // Consumed by docker-compose.yml's postgres/pact-broker services.
        // Only reachable from inside the broker's own docker network, so
        // not treated as a secret like the PACT_BROKER_* creds above.
        POSTGRES_DB = 'pact_broker'
        POSTGRES_USER = 'pact_broker'
        POSTGRES_PASSWORD = 'pact_broker'

        // package.json's pact:publish script falls back to
        // `git rev-parse --abbrev-ref HEAD` for --branch, which resolves to
        // the literal string "HEAD" under Jenkins' detached-HEAD checkout.
        // Supplying GIT_BRANCH short-circuits that fallback with the real
        // branch name so the pact is published under the correct branch
        // (the provider's consumerVersionSelectors relies on { mainBranch }
        // to find it).
        GIT_BRANCH = "${env.BRANCH_NAME ?: 'main'}"

        // Name of the provider pipeline job to trigger after a successful
        // publish. Adjust to match whatever this is actually called in
        // Jenkins (e.g. 'user-service/main' for a multibranch job).
        SERVER_JOB_NAME = 'UserService'
    }

    stages {
        stage('Start Pact Broker') {
            steps {
                // node:20-bullseye has no Docker CLI baked in — install it
                // so this container can drive the host daemon via the
                // socket mounted in `agent` above.
                sh '''
                    apt-get update -qq
                    apt-get install -y -qq curl
                    curl -fsSL https://get.docker.com | sh
                '''
                // Shared with the UserService job (same -p project name),
                // so if that job already started it this is a no-op.
                sh 'docker compose -p pact-broker up -d'
                sh '''
                    for i in $(seq 1 30); do
                        curl -sf http://localhost:9292/diagnostic/status/heartbeat && exit 0
                        sleep 2
                    done
                    echo "Pact Broker did not become healthy in time" >&2
                    exit 1
                '''
            }
            // Deliberately no teardown here: the broker is meant to be
            // shared, long-lived infra (see docker-compose.yml), and the
            // fire-and-forget UserService build triggered at the end of
            // this pipeline still needs it running after this job finishes.
            // Stop it manually with `npm run broker:down` when you're done
            // exercising both pipelines.
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Run consumer tests') {
            steps {
                // Runs tests/users-client.pact.test.js and writes the pact
                // file to pacts/UserWebClient-UserService.json.
                sh 'npm test'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                }
            }
        }

        stage('Publish pact to broker') {
            steps {
                sh 'npm run pact:publish'
            }
        }

        stage('Trigger provider verification') {
            steps {
                // Fire-and-forget: this build doesn't wait on or fail for
                // the provider pipeline's result, it just kicks it off now
                // that a new/changed contract is on the broker.
                build job: env.SERVER_JOB_NAME, wait: false, propagate: false
            }
        }
    }

    post {
        cleanup {
            // Wipes node_modules etc. so the next build's `npm ci` starts
            // from an empty workspace instead of fighting a tree left half
            // torn-down by a prior failed/interrupted build — that
            // half-torn-down state plus Docker Desktop's bind-mount sync
            // lag is what produces ENOENT/ENOTEMPTY spam during npm ci.
            // Requires the Workspace Cleanup plugin.
            cleanWs()
        }
    }
}
