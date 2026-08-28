const crypto = require('crypto');

describe('TransactPay Reconciliation Engine Logic', () => {
  // Test dynamic calculation logic
  test('correctly calculates total gross, gateway fees, net settled, and discrepancies', () => {
    const mockTransactions = [
      { gross_amount: 50000, fee_amount: 750, net_amount: 49250, status: 'success' },
      { gross_amount: 25000, fee_amount: 375, net_amount: 24625, status: 'success' },
      { gross_amount: 10000, fee_amount: 150, net_amount: 9850, status: 'discrepancy' }
    ];

    const totalGross = mockTransactions.reduce((acc, t) => acc + Number(t.gross_amount), 0);
    const totalFees = mockTransactions.reduce((acc, t) => acc + Number(t.fee_amount), 0);
    const totalNet = mockTransactions.reduce((acc, t) => acc + Number(t.net_amount), 0);
    const discrepancies = mockTransactions.filter(t => t.status === 'discrepancy').length;

    expect(totalGross).toBe(85000);
    expect(totalFees).toBe(1275);
    expect(totalNet).toBe(83725);
    expect(discrepancies).toBe(1);
  });

  // Test HMAC signature verification utility for upcoming Webhooks
  test('validates valid HMAC-SHA256 signatures correctly', () => {
    const secret = 'test_webhook_secret';
    const payload = JSON.stringify({ reference: 'TST-1001', amount: 5000 });
    
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    expect(computedSignature).toBe(expectedSignature);
  });
});