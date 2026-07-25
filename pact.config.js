// Single source of truth for the pacticipant names used in this project's
// Pact tests. Must match the provider's own pact.config.js exactly — a typo
// on either side silently produces a pact the other side's Verifier/publish
// step never finds.
module.exports = {
  CONSUMER_NAME: 'UserWebClient',
  PROVIDER_NAME: 'UserService',
};
