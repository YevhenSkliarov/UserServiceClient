// Consumer (UserWebClient) pipeline.
//
// Runs the consumer's Pact test (writes pacts/UserWebClient-UserService.json
// against a Pact mock server, no real provider involved), publishes that
// contract to the Pact Broker, then triggers the provider (UserService)
// pipeline so it re-verifies against what was just published.
pipeline {
    agent {
        docker { image 'node:20-bullseye' }
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // Same three credentials as the provider pipeline — must point at
        // the same broker. See Jenkinsfile in the user-service repo.
        PACT_BROKER_BASE_URL = credentials('pact-broker-base-url')
        PACT_BROKER_USERNAME = credentials('pact-broker-username')
        PACT_BROKER_PASSWORD = credentials('pact-broker-password')

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
}
