const API_BASE_URL = window.location.origin;

// Helper to retrieve JWT Token from localStorage
const getAuthToken = () => localStorage.getItem('transactpay_token');

// Main API Client wrapper
const apiClient = {
  // Generic Request Handler
  async request(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('transactpay_token');
      throw new Error('Unauthorized');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  },

  // 1. Authentication
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('transactpay_token', data.token);
    }
    return data;
  },

  async register(payload) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      localStorage.setItem('transactpay_token', data.token);
    }
    return data;
  },

  async getProfile() {
    return this.request('/api/merchant/me');
  },

  // 2. Transactions & Ingestion
  async getTransactions() {
    return this.request('/api/transactions');
  },

  async uploadCSV(file) {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload CSV');
    }

    return response.json();
  },

  async syncTransactPay() {
    return this.request('/api/sync-transactpay', { method: 'POST' });
  },

  // 3. Discrepancies & Resolution
  async evaluateDiscrepancies(expected_fee_percentage = 0.015) {
    return this.request('/api/reconciliation/evaluate-discrepancies', {
      method: 'POST',
      body: JSON.stringify({ expected_fee_percentage })
    });
  },

  async resolveDiscrepancy(transactionId, resolutionNotes) {
    return this.request(`/api/reconciliation/${transactionId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: resolutionNotes })
    });
  },

  // 4. File Exports (Blob Downloads)
  async downloadReport(type) {
    const token = getAuthToken();
    const endpoint = type === 'pdf' ? '/api/reports/export/pdf' : '/api/reports/export/excel';
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`Failed to download ${type.toUpperCase()} report`);

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'pdf' ? 'settlement_summary.pdf' : 'reconciliation_report.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
};const API_BASE_URL = window.location.origin;

// Helper to retrieve JWT Token from localStorage
const getAuthToken = () => localStorage.getItem('transactpay_token');

// Main API Client wrapper
const apiClient = {
  // Generic Request Handler
  async request(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      localStorage.removeItem('transactpay_token');
      throw new Error('Unauthorized');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  },

  // 1. Authentication
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token) {
      localStorage.setItem('transactpay_token', data.token);
    }
    return data;
  },

  async register(payload) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token) {
      localStorage.setItem('transactpay_token', data.token);
    }
    return data;
  },

  async getProfile() {
    return this.request('/api/auth/me');
  },

  // 2. Merchant Settings & Key Management
  async getMerchantKeys() {
    return this.request('/api/merchant/keys');
  },

  async saveMerchantKeys(secretKey, environment) {
    return this.request('/api/merchant/keys', {
      method: 'POST',
      body: JSON.stringify({ secretKey, environment })
    });
  },

  // 3. Transactions & Ingestion
  async getTransactions() {
    return this.request('/api/transactions');
  },

  async uploadCSV(file) {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload CSV');
    }

    return response.json();
  },

  async syncTransactPay() {
    return this.request('/api/sync-transactpay', { method: 'POST' });
  },

  // 4. Discrepancies & Resolution
  async evaluateDiscrepancies(expected_fee_percentage = 0.015) {
    return this.request('/api/reconciliation/evaluate-discrepancies', {
      method: 'POST',
      body: JSON.stringify({ expected_fee_percentage })
    });
  },

  async resolveDiscrepancy(transactionId, resolutionNotes) {
    return this.request(`/api/reconciliation/${transactionId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: resolutionNotes })
    });
  },

  // 5. File Exports (Blob Downloads)
  async downloadReport(type) {
    const token = getAuthToken();
    const endpoint = type === 'pdf' ? '/api/reports/export/pdf' : '/api/reports/export/excel';
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`Failed to download ${type.toUpperCase()} report`);

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'pdf' ? 'settlement_summary.pdf' : 'reconciliation_report.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
};