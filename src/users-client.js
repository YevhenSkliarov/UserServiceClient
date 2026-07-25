const axios = require('axios');

/**
 * Consumer-side HTTP client for the User Service.
 * This is the real code that ships in the consumer application.
 * The Pact consumer test drives this client against a Pact mock server
 * instead of a real backend.
 */
class UserApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  //get user by id
  async getUser(id) {
    const response = await axios.get(`${this.baseUrl}/users/${id}`, {
      headers: { Accept: 'application/json' },
    });
    return response.data;
  }

  //create user
  async createUser(user) {
    const response = await axios.post(`${this.baseUrl}/users`, user, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    return response.data;
  }
}

module.exports = { UserApiClient };
