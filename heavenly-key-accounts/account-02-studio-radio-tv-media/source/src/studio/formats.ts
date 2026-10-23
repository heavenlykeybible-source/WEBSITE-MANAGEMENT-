export const BROADCAST_FORMATS = {
  tiktok_9_16: { key: 'tiktok_9_16', label: 'TikTok Vertical', width: 1080, height: 1920, aspect: 9 / 16 },
  facebook_3_4: { key: 'facebook_3_4', label: 'Facebook Vertical', width: 1080, height: 1440, aspect: 3 / 4 },
  landscape_16_9: { key: 'landscape_16_9', label: 'Landscape', width: 1280, height: 720, aspect: 16 / 9 },
} as const;

export type BroadcastFormat = keyof typeof BROADCAST_FORMATS;

export const BROADCAST_SOURCES = ['camera', 'video', 'picture_audio', 'bible', 'hymn'] as const;

export const AUDIO_FEATURES = {
  nativeNoiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  highPassFilterHz: 70,
  presenceBoostDb: 2.5,
  compressorRatio: 3.2,
  limiter: true,
  lowPassFilterHz: 14500,
} as const;
