document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initial Load & Auth Verification
  try {
    const profile = await apiClient.getProfile();
    document.getElementById('merchant-name').innerText = profile.name;
  } catch (err) {
    console.error('Session expired or unauthorized:', err);
    window.location.href = '/login.html';
    return;
  }

  // 2. Fetch and Render Transactions Table
  async function loadTransactions() {
    try {
      const transactions = await apiClient.getTransactions();
      const tableBody = document.getElementById('transactions-table-body');
      
      if (!tableBody) return;
      tableBody.innerHTML = '';

      transactions.forEach(tx => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${tx.transaction_ref}</td>
          <td>${tx.customer_email || 'N/A'}</td>
          <td>₦${Number(tx.gross_amount).toLocaleString()}</td>
          <td>₦${Number(tx.fee).toLocaleString()}</td>
          <td>₦${Number(tx.net_amount).toLocaleString()}</td>
          <td><span class="badge status-${tx.status.toLowerCase()}">${tx.status}</span></td>
          <td>
            ${tx.status === 'discrepancy' 
              ? `<button class="btn btn-sm btn-warning" onclick="handleResolve(${tx.id})">Resolve</button>` 
              : '<span class="text-muted">N/A</span>'}
          </td>
        `;
        tableBody.appendChild(row);
      });
    } catch (err) {
      alert(`Error loading transactions: ${err.message}`);
    }
  }

  // 3. Event Listeners for User Actions

  // CSV File Upload
  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('csv-file');
      if (!fileInput.files[0]) return alert('Please select a file to upload.');

      try {
        const res = await apiClient.uploadCSV(fileInput.files[0]);
        alert(res.message);
        loadTransactions();
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    });
  }

  // Sync TransactPay API
  const syncBtn = document.getElementById('sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      try {
        syncBtn.innerText = 'Syncing...';
        const res = await apiClient.syncTransactPay();
        alert(res.message);
        loadTransactions();
      } catch (err) {
        alert(`Sync failed: ${err.message}`);
      } finally {
        syncBtn.innerText = 'Sync TransactPay';
      }
    });
  }

  // Export Excel Report
  const exportExcelBtn = document.getElementById('export-excel');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => apiClient.downloadReport('excel'));
  }

  // Export PDF Report
  const exportPdfBtn = document.getElementById('export-pdf');
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => apiClient.downloadReport('pdf'));
  }

  // Load initial data
  loadTransactions();
});

// Global Discrepancy Resolution Handler
async function handleResolve(transactionId) {
  const notes = prompt('Enter resolution notes:');
  if (!notes) return;

  try {
    await apiClient.resolveDiscrepancy(transactionId, notes);
    alert('Discrepancy marked as resolved.');
    window.location.reload();
  } catch (err) {
    alert(`Resolution failed: ${err.message}`);
  }
}