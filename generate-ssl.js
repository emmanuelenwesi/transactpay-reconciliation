const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

async function createCertificates() {
  console.log('Generating self-signed SSL certificates...');

  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pki = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });

  const sslDir = path.join(__dirname, 'nginx', 'ssl');

  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  // Handle both Sync/Async response formats (cert/private or cert/key)
  const privateKeyData = pki.private || pki.key;
  const certData = pki.cert;

  if (!privateKeyData || !certData) {
    throw new Error('Failed to extract certificate key pair from selfsigned package.');
  }

  fs.writeFileSync(path.join(sslDir, 'key.pem'), privateKeyData);
  fs.writeFileSync(path.join(sslDir, 'cert.pem'), certData);

  console.log('SSL Certificates successfully generated:');
  console.log(' - nginx/ssl/key.pem');
  console.log(' - nginx/ssl/cert.pem');
}

createCertificates().catch((err) => {
  console.error('Error generating SSL certificates:', err.message);
  process.exit(1);
});
