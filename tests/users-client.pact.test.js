const path = require('path');
const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const { UserApiClient } = require('../src/users-client');
const { CONSUMER_NAME, PROVIDER_NAME } = require('../pact.config');

const { integer, string, regex } = MatchersV3;

// Note: Content-Type can't use a matcher here — Pact's Rust core parses it
// as a literal MIME type to decide how to handle the body, so it has to be
// an exact string, not a matching rule.
const EMAIL = regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'ada@example.com');

// The Pact object is the mock provider. It records every interaction
// you define below into a pact CONTRACT FILE (JSON) once the test passes.
const provider = new PactV3({
  consumer: CONSUMER_NAME,
  provider: PROVIDER_NAME,
  dir: path.resolve(process.cwd(), 'pacts'), // where the contract file is written
  logLevel: 'warn',
});

describe('User API Consumer Contract', () => {
  test('GET /users/:id - existing user', async () => {
    // 1. ARRANGE: describe the expected interaction
    provider
      // Provider states take parameters instead of baking the id into the
      // description string — the provider's stateHandlers receive these
      // directly, so the same state name works for any id.
      .given('a user exists', { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' })
      .uponReceiving('a request for user 1') // human-readable description
      .withRequest({
        method: 'GET',
        path: '/users/1',
        headers: { Accept: 'application/json', 'Accept-language': 'en-US' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          // Matchers mean "any integer/string is fine, but this is a realistic example".
          // This is what makes Pact tests resilient to data changes.
          id: integer(1),
          name: string('Ada Lovelace'),
          email: EMAIL,
        },
      });

    // 2. ACT: run the real consumer code against Pact's mock server
    await provider.executeTest(async (mockServer) => {
      const client = new UserApiClient(mockServer.url);
      const user = await client.getUser(1);

      // 3. ASSERT: verify the consumer parsed the response correctly
      expect(user).toEqual({
        id: 1,
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      });
    });
  });

  test('GET /users/:id - user not found', async () => {
    provider
      .given('a user does not exist', { id: 999 })
      .uponReceiving('a request for a missing user')
      .withRequest({
        method: 'GET',
        path: '/users/999',
        headers: { Accept: 'application/json', 'Accept-language': 'en-US' },
      })
      .willRespondWith({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: string('User not found') },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UserApiClient(mockServer.url);

      await expect(client.getUser(999)).rejects.toMatchObject({
        response: {
          status: 404,
          data: { error: 'User not found' },
        },
      });
    });
  });

  test('POST /users - creates a new user', async () => {
    provider
      .given('no users exist')
      .uponReceiving('a request to create a user')
      .withRequest({
        method: 'POST',
        path: '/users',
        headers: { 'Content-Type': 'application/json', 'Accept-language': 'en-US' },
        body: { name: 'Grace Hopper', email: 'grace@example.com' },
      })
      .willRespondWith({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: integer(1),
          name: string('Grace Hopper'),
          email: regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'grace@example.com'),
        },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UserApiClient(mockServer.url);
      const user = await client.createUser({ name: 'Grace Hopper', email: 'grace@example.com' });

      expect(user).toEqual({
        id: 1,
        name: 'Grace Hopper',
        email: 'grace@example.com',
      });
    });
  });

  test('POST /users - missing required fields', async () => {
    provider
      .given('no users exist')
      .uponReceiving('a request to create a user with missing fields')
      .withRequest({
        method: 'POST',
        path: '/users',
        headers: { 'Content-Type': 'application/json', 'Accept-language': 'en-US' },
        body: { name: 'Incomplete User' },
      })
      .willRespondWith({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: string('name and email are required') },
      });

    await provider.executeTest(async (mockServer) => {
      const client = new UserApiClient(mockServer.url);

      await expect(client.createUser({ name: 'Incomplete User' })).rejects.toMatchObject({
        response: {
          status: 400,
          data: { error: 'name and email are required' },
        },
      });
    });
  });
});
