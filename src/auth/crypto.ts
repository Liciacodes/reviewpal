// Small crypto helpers for sign-in. Pure: the key is passed in, nothing is read from env here.
import crypto from 'node:crypto';

// Turns TOKEN_ENCRYPTION_KEY (base64) into the 32-byte key AES-256 needs
export function parseKey(base64: string | undefined): Buffer {
  const key = Buffer.from(base64 ?? '', 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes in base64');
  }
  return key;
}

// Encrypts text with AES-256-GCM. Output: "iv.tag.ciphertext" (each base64url).
// A fresh random IV each time, so the same text never encrypts to the same output.
export function encrypt(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // detects any change to the ciphertext
  return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

// Reverses encrypt(). Throws if the value was changed or the key is wrong.
export function decrypt(value: string, key: Buffer): string {
  const [iv, tag, data] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed encrypted value');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Like decrypt(), but null instead of an error when the value can't be read
// (changed, or encrypted with a different key)
export function tryDecrypt(value: string, key: Buffer): string | null {
  try {
    return decrypt(value, key);
  } catch {
    return null;
  }
}

// A random, URL-safe token (32 bytes = 256 bits)
export function randomToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

// SHA-256 as hex. We store hashes of session tokens, never the tokens themselves.
export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Compares two secrets without leaking how many characters matched (timing-safe)
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
