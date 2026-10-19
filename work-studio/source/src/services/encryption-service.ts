/**
 * Encryption service — resolves ACR-010 and the first Independent Audit's
 * Critical Finding 1 ("encrypted-sounding columns contain no encryption").
 * Real AES-256-GCM via Workers' native Web Crypto. Ciphertext and IV are
 * stored separately, exactly as the schema was patched to support.
 */

async function importKey(secretHex: string): Promise<CryptoKey> {
  if (!/^[0-9a-f]{64}$/i.test(secretHex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key.");
  }
  const pairs = secretHex.match(/.{2}/g);
  if (!pairs) throw new Error("ENCRYPTION_KEY is invalid.");
  const keyBytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export interface EncryptedField {
  ciphertext: string; // hex
  iv: string; // hex
}

export async function encryptField(plaintext: string, secretHex: string): Promise<EncryptedField> {
  const key = await importKey(secretHex);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV, standard for GCM
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { ciphertext: bufToHex(ciphertextBuf), iv: bufToHex(iv.buffer) };
}

export async function decryptField(ciphertextHex: string, ivHex: string, secretHex: string): Promise<string> {
  const key = await importKey(secretHex);
  const iv = hexToBuf(ivHex);
  const ciphertext = hexToBuf(ciphertextHex);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBuf(hex: string): ArrayBuffer {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid hexadecimal ciphertext.");
  const pairs = hex.match(/.{2}/g);
  if (!pairs) throw new Error("Invalid hexadecimal ciphertext.");
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)));
  return bytes.buffer;
}
