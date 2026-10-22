/**
 * Heavenly Key Live Studio — browser microphone processing.
 *
 * Open-source/browser-first approach:
 * 1. Ask the browser for native echo cancellation, noise suppression and AGC.
 * 2. Add a lightweight Web Audio voice chain for high-pass filtering,
 *    presence shaping, compression and a final safety limiter.
 *
 * This deliberately does not promise impossible noise removal. Very loud
 * speech, clipping, wind, music or severe room noise can still require a
 * better microphone or heavier DSP.
 */

export type ProfessionalMicOptions = {
  sampleRate?: number;
  channelCount?: number;
  deviceId?: string;
  enabled?: boolean;
};

export function professionalMicrophoneConstraints(options: ProfessionalMicOptions = {}) {
  return {
    audio: {
      deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
      channelCount: options.channelCount ?? 1,
      sampleRate: options.sampleRate ?? 48000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      latency: { ideal: 0.02 },
    },
    video: false,
  } as MediaStreamConstraints;
}

export function buildProfessionalVoiceChain(
  context: AudioContext,
  input: MediaStreamAudioSourceNode,
) {
  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 70;
  highPass.Q.value = 0.707;

  const presence = context.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 0.9;
  presence.gain.value = 2.5;

  const lowPass = context.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 14500;
  lowPass.Q.value = 0.707;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.12;

  const makeup = context.createGain();
  makeup.gain.value = 1.35;

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.06;

  input
    .connect(highPass)
    .connect(presence)
    .connect(lowPass)
    .connect(compressor)
    .connect(makeup)
    .connect(limiter);

  return { input, highPass, presence, lowPass, compressor, makeup, limiter };
}
