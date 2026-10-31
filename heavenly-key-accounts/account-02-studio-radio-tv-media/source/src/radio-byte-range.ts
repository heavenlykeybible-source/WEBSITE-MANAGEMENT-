export type AudioRange = { offset: number; length: number };
export function parseAudioRange(header: string | null, size: number): AudioRange | null | false {
  if (header === null) return null;
  if (!Number.isSafeInteger(size) || size < 1) return false;
  const matched = /^bytes=([0-9]*)-([0-9]*)$/.exec(header.trim());
  if (!matched || (!matched[1] && !matched[2])) return false;
  if (!matched[1]) {
    const suffix = Number(matched[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return false;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }
  const offset = Number(matched[1]);
  const last = matched[2] ? Number(matched[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(last) || offset >= size || last < offset) return false;
  return { offset, length: Math.min(last, size - 1) - offset + 1 };
}
