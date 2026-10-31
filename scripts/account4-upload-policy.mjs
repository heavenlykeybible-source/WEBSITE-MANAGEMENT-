// Upload validation for the future authenticated R2 multipart import route.
// No storage operations or publication are performed by this module.
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const PART_BYTES = 10 * 1024 * 1024;
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,199}$/;
const BLOCKED_EXT = /\.(?:exe|dll|bat|cmd|ps1|sh|php|phtml|phar|jsp|jspx|aspx|asp|cgi|env|pem|key)(?:\.|$)/i;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function validateImportMetadata(file, actor) {
  if (!file || typeof file !== 'object' || Array.isArray(file))
    throw new Error('Valid import metadata required');
  const {name, size} = file;
  if (!actor || actor.authenticated !== true || actor.canImport !== true ||
      !Number.isSafeInteger(actor.id) || actor.id <= 0)
    throw new Error('Authenticated import permission required');
  if (typeof name !== 'string' || !SAFE_NAME.test(name) || name === '.' || name === '..' ||
      name.includes('..') || /[. ]$/.test(name) || WINDOWS_RESERVED.test(name) || BLOCKED_EXT.test(name))
    throw new Error('Invalid or disallowed file name');
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES)
    throw new Error('File size outside 1 GiB limit');
  return Object.freeze({name, size, partSize: PART_BYTES, partCount: Math.ceil(size / PART_BYTES)});
}
export function validatePart({partNumber, byteLength}, metadata) {
  if (!metadata || !Number.isSafeInteger(metadata.size) || !Number.isSafeInteger(metadata.partCount))
    throw new Error('Validated upload metadata required');
  if (!Number.isSafeInteger(partNumber) || partNumber < 1 || partNumber > metadata.partCount)
    throw new Error('Invalid part number');
  const expected = Math.min(PART_BYTES, metadata.size - (partNumber - 1) * PART_BYTES);
  if (!Number.isSafeInteger(byteLength) || byteLength !== expected)
    throw new Error('Unexpected part size');
  return true;
}
