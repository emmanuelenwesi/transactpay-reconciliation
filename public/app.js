document.addEventListener('DOMContentLoaded', () => {
  let isRegisterMode = false;
  let allTransactions = [];

  const authModalEl = document.getElementById('authModal');
  const authModal = authModalEl ? new bootstrap.Modal(authModalEl) : null;

  const reconciliationRoutes = require('./routes/reconciliation');
  // UI Element References
  const merchantWelcome = document.getElementById('merchant-welcome');
  const btnSync = document.getElementById('btn-sync');
  const btnAuthAction = document.getElementById('btn-auth-action');
  const btnSettings = document.getElementById('btn-settings');
  
  const metricGross = document.getElementById('metric-gross');
  const metricFees = document.getElementById('metric-fees');
  const metricNet = document.getElementById('metric-net');
  const metricDiscrepancies = document.getElementById('metric-discrepancies');

  const transactionsBody = document.getElementById('transactions-body');
  const searchInput = document.getElementById('search-input');
  const alertBanner = document.getElementById('alert-banner');
  const btnExportCsv = document.getElementById('btn-export-csv');
// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/transactions', transactionRoutes);

// NEW: Mount reconciliation endpoint
app.use('/api/reconciliation', reconciliationRoutes);

  // Modal / Auth References
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const authModalLabel = document.getElementById('authModalLabel');
  const btnAuthSubmit = document.getElementById('btn-auth-submit');
  const toggleAuthMode = document.getElementById('toggle-auth-mode');
  const groupName = document.getElementById('group-name');
  const groupApiKeys = document.getElementById('group-api-keys');

  // Settings Modal References
  const settingsModalEl = document.getElementById('settingsModal');
  const settingsForm = document.getElementById('settings-form');
  const settingsAlert = document.getElementById('settings-alert');

  // Initialization & Session Management
  async function init() {
    const token = localStorage.getItem('transactpay_token');
    if (!token) {
      showLoggedOutState();
      return;
    }

    try {
      const profile = await apiClient.getProfile();
      showLoggedInState(profile.name || profile.email);
      await loadTransactions();
    } catch (err) {
      showLoggedOutState();
    }
  }

  function showLoggedInState(name) {
    if (merchantWelcome) {
      merchantWelcome.innerText = `Welcome, ${name}`;
      merchantWelcome.style.display = 'inline';
    }
    if (btnSync) btnSync.style.display = 'inline';
    if (btnSettings) btnSettings.style.display = 'inline-block';
    if (btnAuthAction) {
      btnAuthAction.innerText = 'Logout';
      btnAuthAction.removeAttribute('data-bs-toggle');
      btnAuthAction.removeAttribute('data-bs-target');
      btnAuthAction.onclick = logout;
    }
  }

  function showLoggedOutState() {
    if (merchantWelcome) merchantWelcome.style.display = 'none';
    if (btnSync) btnSync.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
    if (btnAuthAction) {
      btnAuthAction.innerText = 'Login / Register';
      btnAuthAction.setAttribute('data-bs-toggle', 'modal');
      btnAuthAction.setAttribute('data-bs-target', '#authModal');
      btnAuthAction.onclick = null;
    }
    if (transactionsBody) {
      transactionsBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Please login to view transactions.</td></tr>';
    }
    resetMetrics();
  }

  function logout() {
    localStorage.removeItem('transactpay_token');
    showLoggedOutState();
    showAlert('Logged out successfully.', 'info');
  }

  // Load Data and Update UI
  async function loadTransactions() {
    try {
      allTransactions = await apiClient.getTransactions();
      renderTransactions(allTransactions);
      updateMetrics(allTransactions);
    } catch (err) {
      showAlert(`Failed to load data: ${err.message}`, 'danger');
    }
  }

  function updateMetrics(txs) {
    let gross = 0, fees = 0, net = 0, discrepancies = 0;

    txs.forEach(t => {
      gross += Number(t.gross_amount || 0);
      fees += Number(t.fee || 0);
      net += Number(t.net_amount || 0);
      if (t.status === 'discrepancy') discrepancies++;
    });

    if (metricGross) metricGross.innerText = `₦${gross.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if (metricFees) metricFees.innerText = `₦${fees.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if (metricNet) metricNet.innerText = `₦${net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    if (metricDiscrepancies) metricDiscrepancies.innerText = discrepancies;
  }

  function resetMetrics() {
    if (metricGross) metricGross.innerText = '₦0.00';
    if (metricFees) metricFees.innerText = '₦0.00';
    if (metricNet) metricNet.innerText = '₦0.00';
    if (metricDiscrepancies) metricDiscrepancies.innerText = '0';
  }

  function renderTransactions(txs) {
    if (!transactionsBody) return;
    if (txs.length === 0) {
      transactionsBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No transactions found.</td></tr>';
      return;
    }

    transactionsBody.innerHTML = txs.map(t => `
      <tr>
        <td class="fw-bold">${t.transaction_ref || 'N/A'}</td>
        <td>${t.customer_email || 'N/A'}</td>
        <td>${t.channel || 'API'}</td>
        <td>₦${Number(t.gross_amount).toLocaleString()}</td>
        <td class="text-danger">₦${Number(t.fee).toLocaleString()}</td>
        <td class="text-success fw-bold">₦${Number(t.net_amount).toLocaleString()}</td>
        <td><span class="badge ${getStatusBadge(t.status)}">${t.status}</span></td>
        <td>${new Date(t.created_at || Date.now()).toLocaleDateString()}</td>
      </tr>
    `).join('');
  }

  function getStatusBadge(status) {
    switch ((status || '').toLowerCase()) {
      case 'settled': case 'successful': return 'bg-success';
      case 'discrepancy': return 'bg-warning text-dark';
      case 'pending': return 'bg-secondary';
      default: return 'bg-danger';
    }
  }

  // Authentication Switcher and Form Handler
  if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      authModalLabel.innerText = isRegisterMode ? 'Merchant Registration' : 'Merchant Login';
      btnAuthSubmit.innerText = isRegisterMode ? 'Register' : 'Login';
      toggleAuthMode.innerText = isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Register";
      groupName.style.display = isRegisterMode ? 'block' : 'none';
      groupApiKeys.style.display = isRegisterMode ? 'block' : 'none';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.classList.add('d-none');

      const email = document.getElementById('auth-email').value;
      const password = document.getElementById('auth-password').value;

      try {
        if (isRegisterMode) {
          const name = document.getElementById('auth-name').value;
          const secretKey = document.getElementById('auth-secret-key').value || null;
          const environment = document.getElementById('auth-environment').value || 'sandbox';
          await apiClient.register({ name, email, password, secretKey, environment });
        } else {
          await apiClient.login(email, password);
        }

        if (authModal) authModal.hide();
        init();
      } catch (err) {
        authError.innerText = err.message;
        authError.classList.remove('d-none');
      }
    });
  }

  // Settings Modal Logic
  if (settingsModalEl) {
    settingsModalEl.addEventListener('show.bs.modal', async () => {
      try {
        const data = await apiClient.getMerchantKeys();
        document.getElementById('setting-current-key').value = data.maskedKey || 'None linked';
        document.getElementById('setting-environment').value = data.environment || 'sandbox';
      } catch (err) {
        console.error('Error fetching keys:', err);
      }
    });
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const secretKey = document.getElementById('setting-secret-key').value;
      const environment = document.getElementById('setting-environment').value;

      try {
        const res = await apiClient.saveMerchantKeys(secretKey, environment);
        settingsAlert.className = 'alert alert-success';
        settingsAlert.innerText = res.message;
        settingsAlert.classList.remove('d-none');
        document.getElementById('setting-secret-key').value = '';

        const updated = await apiClient.getMerchantKeys();
        document.getElementById('setting-current-key').value = updated.maskedKey;
      } catch (err) {
        settingsAlert.className = 'alert alert-danger';
        settingsAlert.innerText = err.message;
        settingsAlert.classList.remove('d-none');
      }
    });
  }

  // File Upload Handling
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('csv-file');
      if (!fileInput.files[0]) return;

      try {
        const res = await apiClient.uploadCSV(fileInput.files[0]);
        showAlert(res.message || 'CSV Processed successfully', 'success');
        loadTransactions();
      } catch (err) {
        showAlert(err.message, 'danger');
      }
    });
  }

  // TransactPay API Sync Integration
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      try {
        btnSync.innerText = 'Syncing...';
        const res = await apiClient.syncTransactPay();
        showAlert(res.message || 'Sync complete', 'success');
        loadTransactions();
      } catch (err) {
        showAlert(err.message, 'danger');
      } finally {
        btnSync.innerText = 'Sync TransactPay API';
      }
    });
  }

  // Search Filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = allTransactions.filter(t => 
        (t.transaction_ref && t.transaction_ref.toLowerCase().includes(q)) ||
        (t.customer_email && t.customer_email.toLowerCase().includes(q)) ||
        (t.status && t.status.toLowerCase().includes(q)) ||
        (t.channel && t.channel.toLowerCase().includes(q))
      );
      renderTransactions(filtered);
    });
  }

  // Export Filtered Data to Excel Report
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      try {
        await apiClient.downloadReport('excel');
      } catch (err) {
        showAlert(`Export failed: ${err.message}`, 'danger');
      }
    });
  }

  // Dynamic Alert Notification Banner
  function showAlert(message, type) {
    if (!alertBanner) return;
    alertBanner.className = `alert alert-${type}`;
    alertBanner.innerText = message;
    alertBanner.classList.remove('d-none');
    setTimeout(() => alertBanner.classList.add('d-none'), 4000);
  }

  // Start Application Lifecycle
  init();
});