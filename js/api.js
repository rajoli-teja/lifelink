// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// API Object
const api = {
  // Set authentication token
  setToken(token) {
    localStorage.setItem('token', token);
  },

  // Get authentication token
  getToken() {
    return localStorage.getItem('token');
  },

  // Make authenticated API request
  async request(endpoint, options = {}) {
    const token = this.getToken();
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  },

  // User Authentication
  async login(credentials) {
    return this.request('/users/login', {
      method: 'POST',
      body: credentials,
    });
  },

  async register(userData) {
    return this.request('/users/register', {
      method: 'POST',
      body: userData,
    });
  },

  // User Profile
  async getProfile() {
    return this.request('/users/profile');
  },

  async updateProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PATCH',
      body: profileData,
    });
  },

  // Donations
  async createDonation(donationData) {
    return this.request('/donations', {
      method: 'POST',
      body: donationData,
    });
  },

  async getDonations() {
    return this.request('/donations');
  },

  async updateDonationStatus(donationId, status) {
    return this.request(`/donations/${donationId}`, {
      method: 'PATCH',
      body: { status },
    });
  },

  // Statistics
  async getStats() {
    return this.request('/users/stats');
  },

  async getDonationStats() {
    return this.request('/donations/stats');
  },

  // Admin functions
  async getAllUsers() {
    return this.request('/users/all');
  },

  async deleteUser(userId) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}