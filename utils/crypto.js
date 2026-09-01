const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedData: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag
  };
}

function decrypt(cipherInput, inputIv, inputAuthTag) {
  let iv, authTag, encryptedText;

  if (typeof cipherInput === "object" && cipherInput !== null) {
    iv = Buffer.from(cipherInput.iv, "hex");
    authTag = Buffer.from(cipherInput.authTag, "hex");
    encryptedText = cipherInput.encryptedData;
  } else if (inputIv && inputAuthTag) {
    iv = Buffer.from(inputIv, "hex");
    authTag = Buffer.from(inputAuthTag, "hex");
    encryptedText = cipherInput;
  } else if (typeof cipherInput === "string") {
    const parts = cipherInput.split(":");
    if (parts.length !== 3) throw new Error("Invalid cipher text format");
    iv = Buffer.from(parts[0], "hex");
    authTag = Buffer.from(parts[1], "hex");
    encryptedText = parts[2];
  } else {
    throw new Error("Invalid arguments passed to decrypt");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = { encrypt, decrypt };