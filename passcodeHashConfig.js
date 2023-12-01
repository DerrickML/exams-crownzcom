import crypto from "crypto";
import dotenv from "dotenv"
dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/***********************************************/
// ENCRYPTION AND DECRYPTION
// const ENCRYPTION_KEY = crypto.randomBytes(32); // This should ideally be stored securely and not hardcoded
// console.log(ENCRYPTION_KEY.toString("hex")); //For generating the key
const IV_LENGTH = 16; // For AES, this is always 16
/***********************************************/

// Encryption function
function encrypt(text) {
  let iv = crypto.randomBytes(IV_LENGTH);
  let cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export { ENCRYPTION_KEY, encrypt };
