const { encrypt, decrypt } = require('../../utils/crypto');

describe('AES-256-GCM Crypto Utility Tests', () => {
  const sampleSecretKey = 'sec_live_998877665544332211aabbcc';

  it('should encrypt a plaintext secret key and return cipher text, IV, and authTag', () => {
    const encrypted = encrypt(sampleSecretKey);

    expect(encrypted).toHaveProperty('encryptedData');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('authTag');
    expect(encrypted.encryptedData).not.toBe(sampleSecretKey);
  });

  it('should successfully decrypt back to original plaintext', () => {
    const encrypted = encrypt(sampleSecretKey);
    const decrypted = decrypt(encrypted.encryptedData, encrypted.iv, encrypted.authTag);

    expect(decrypted).toBe(sampleSecretKey);
  });

  it('should throw an error when attempting to decrypt with corrupted data or tag', () => {
    const encrypted = encrypt(sampleSecretKey);
    const corruptedTag = '00000000000000000000000000000000';

    expect(() => {
      decrypt(encrypted.encryptedData, encrypted.iv, corruptedTag);
    }).toThrow();
  });
});