/** Audio-on-demand delivery: no permanent encoder, virtual machine, or radio loop. */
export const RADIO_PLAYBACK_MODE='listener-activated' as const;
export function onDemandRadioMetadata(){
 return {
  delivery:RADIO_PLAYBACK_MODE,
  listenerStartsPlayback:true,
  alwaysOnEncoderRequired:false,
  standbyComputeRequired:false,
  loopPlaylist:true,
  nextTrackTrigger:'ended',
  audioFetch:'on-demand-range',
  synchronizedListeners:false,
  note:'Playback starts with the listener Play action. Each listener has their own playlist position; this is not a synchronized live radio stream.'
 };
}
