import {createHash} from 'node:crypto';

export function assertReviewedAccount4Source(source, metadata) {
  if (typeof source !== 'string' || source.length < 10000 ||
      !metadata || typeof metadata !== 'object' ||
      !/^[a-f0-9]{64}$/i.test(metadata.after_sha256 || '') ||
      !/^[a-f0-9]{64}$/i.test(metadata.built_sha256 || '')) {
    throw new Error('Account 4 deployment blocked: reviewed source metadata is missing or invalid');
  }
  const digest = createHash('sha256').update(source, 'utf8').digest('hex');
  if (digest !== metadata.after_sha256 && digest !== metadata.built_sha256) {
    throw new Error('Account 4 deployment blocked: Worker source is not the exact reviewed build');
  }
  return digest;
}
