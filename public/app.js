document.addEventListener('DOMContentLoaded', () => {
  let isRegisterMode = false;
  let allTransactions = [];
  let filteredTransactions = [];

  const authModal = new bootstrap.Modal(document.getElementById('authModal'));

  // UI Elements
  const authForm = document.getElementById('auth-form');
  const toggleAuthMode = document.getElementById('toggle-auth-mode');
  const authModalLabel = document.getElementById('authModalLabel');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const groupName = document.getElementById('group-name');
  const groupApiKeys = document.getElementById('group-api-keys');
  const authError = document.getElementById('auth-error');
  const merchantWelcome = document.getElementById('merchant-welcome');
  const btnAuthAction = document.getElementById('btn-auth-action');
  const btnSync = document.getElementById('btn-sync');
  const uploadForm = document.getElementById('upload-form');
  const transactionsBody = document.getElementById('transactions-body');
  const searchInput = document.getElementById('search-input');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Metrics Elements
  const metricGross = document.getElementById('metric-gross');
  const metricFees = document.getElementById('metric-fees');
  const metricNet = document.getElementById('metric-net');
  const metricDiscrepancies = document.getElementById('metric-discrepancies');

  checkAuthState();

  // Mode Toggle (Login <-> Register)
  toggleAuthMode.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    authError.classList.add('d-none');
    
    if (isRegisterMode) {
      authModalLabel.innerText = 'Register Merchant Account';
      btnAuthSubmit.innerText = 'Register & Login';
      groupName.style.display = 'block';
      groupApiKeys.style.display = 'block';
      toggleAuthMode.innerText = 'Already have an account? Login';
    } else {
      authModalLabel.innerText = 'Merchant Login';
      btnAuthSubmit.innerText = 'Login';
      groupName.style.display = 'none';
      groupApiKeys.style.display = 'none';
      toggleAuthMode.innerText = "Don't have an account? Register";
    }
  });

  // Handle Authentication Submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('d-none');

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegisterMode ? {
      name: document.getElementById('auth-name').value,
      email,
      password,
      secret_key: document.getElementById('auth-secret-key').value,
      environment: document.getElementById('auth-environment').value
    } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('tp_token', data.token);
      localStorage.setItem('tp_merchant', JSON.stringify(data.merchant));

      authModal.hide();
      authForm.reset();
      checkAuthState();
    } catch (err) {
      authError.innerText = err.message;
      authError.classList.remove('d-none');
    }
  });

  // Logout / Login Action Button
  btnAuthAction.addEventListener('click', () => {
    if (localStorage.getItem('tp_token')) {
      localStorage.removeItem('tp_token');
      localStorage.removeItem('tp_merchant');
      checkAuthState();
    }
  });

  // Verify Auth State
  function checkAuthState() {
    const token = localStorage.getItem('tp_token');
    const merchant = JSON.parse(localStorage.getItem('tp_merchant') || '{}');

    if (token && merchant.id) {
      merchantWelcome.innerText = `Merchant: ${merchant.name}`;
      merchantWelcome.style.display = 'inline';
      btnAuthAction.innerText = 'Logout';
      btnAuthAction.className = 'btn btn-sm btn-outline-light';
      btnAuthAction.removeAttribute('data-bs-toggle');
      btnSync.style.display = 'inline-block';
      fetchTransactions();
    } else {
      merchantWelcome.style.display = 'none';
      btnAuthAction.innerText = 'Login / Register';
      btnAuthAction.className = 'btn btn-sm btn-primary';
      btnAuthAction.setAttribute('data-bs-toggle', 'modal');
      btnSync.style.display = 'none';
      resetMetrics();
      transactionsBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Please login to view transactions.</td></tr>';
    }
  }

  // Fetch Merchant Transactions
  async function fetchTransactions() {
    const token = localStorage.getItem('tp_token');
    try {
      const res = await fetch('/api/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load transactions');
      
      allTransactions = await res.json();
      filteredTransactions = [...allTransactions];
      renderDashboard();
    } catch (err) {
      console.error(err);
    }
  }

  // Render Dashboard Table and Metrics
  function renderDashboard() {
    renderTable(filteredTransactions);
    calculateMetrics(filteredTransactions);
  }

  // Render Table Rows
  function renderTable(data) {
    if (!data.length) {
      transactionsBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No settlements found.</td></tr>';
      return;
    }

    transactionsBody.innerHTML = data.map(tx => `
      <tr>
        <td class="fw-semibold">${tx.transaction_ref}</td>
        <td>${tx.customer_email}</td>
        <td><span class="badge bg-secondary">${tx.channel}</span></td>
        <td>₦${parseFloat(tx.gross_amount).toFixed(2)}</td>
        <td class="text-danger">-₦${parseFloat(tx.fee).toFixed(2)}</td>
        <td class="fw-bold text-success">₦${parseFloat(tx.net_amount).toFixed(2)}</td>
        <td><span class="badge bg-${tx.status === 'success' ? 'success' : tx.status === 'failed' ? 'danger' : 'warning'}">${tx.status}</span></td>
        <td>${new Date(tx.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }

  // Calculate Metric Cards dynamically
  function calculateMetrics(data) {
    let gross = 0;
    let fees = 0;
    let net = 0;
    let discrepancies = 0;

    data.forEach(tx => {
      const g = parseFloat(tx.gross_amount) || 0;
      const f = parseFloat(tx.fee) || 0;
      const n = parseFloat(tx.net_amount) || 0;

      gross += g;
      fees += f;
      net += n;

      if (tx.status !== 'success' || Math.abs(g - f - n) > 0.01) {
        discrepancies++;
      }
    });

    metricGross.innerText = `₦${gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricFees.innerText = `₦${fees.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricNet.innerText = `₦${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    metricDiscrepancies.innerText = discrepancies;
  }

  function resetMetrics() {
    metricGross.innerText = '₦0.00';
    metricFees.innerText = '₦0.00';
    metricNet.innerText = '₦0.00';
    metricDiscrepancies.innerText = '0';
  }

  // Live Search Filtering
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    filteredTransactions = allTransactions.filter(tx => 
      (tx.transaction_ref && tx.transaction_ref.toLowerCase().includes(term)) ||
      (tx.customer_email && tx.customer_email.toLowerCase().includes(term)) ||
      (tx.status && tx.status.toLowerCase().includes(term)) ||
      (tx.channel && tx.channel.toLowerCase().includes(term))
    );
    renderDashboard();
  });

  // Export Filtered Data to CSV
  btnExportCsv.addEventListener('click', () => {
    if (!filteredTransactions.length) {
      alert('No data available to export.');
      return;
    }

    const headers = ['Reference', 'Customer Email', 'Channel', 'Gross Amount', 'Fee', 'Net Amount', 'Status', 'Date'];
    const rows = filteredTransactions.map(tx => [
      `"${tx.transaction_ref}"`,
      `"${tx.customer_email}"`,
      `"${tx.channel}"`,
      tx.gross_amount,
      tx.fee,
      tx.net_amount,
      `"${tx.status}"`,
      `"${new Date(tx.created_at).toISOString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reconciliation_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // CSV Upload Submission
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('tp_token');
    const fileInput = document.getElementById('csv-file');

    if (!token) {
      alert('Please log in first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      alert(data.message || data.error);
      fileInput.value = '';
      fetchTransactions();
    } catch (err) {
      alert('Error uploading file');
    }
  });

  // Manual API Sync Button
  btnSync.addEventListener('click', async () => {
    const token = localStorage.getItem('tp_token');
    try {
      const res = await fetch('/api/sync-transactpay', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      alert(data.message || data.error);
      fetchTransactions();
    } catch (err) {
      alert('API Sync failed');
    }
  });
});