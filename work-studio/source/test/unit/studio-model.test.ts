import {describe,it,expect} from 'vitest';
import {normalizePreset,fitRect,microphoneLevel,musicLevel,wrapText,backgroundPresets} from '../../heavenly-key-website/js/studio-model.js';
describe('studio scene and audio rules',()=>{
 it('keeps three built-in low-data moving backgrounds available',()=>{
  const moving=backgroundPresets.filter(([,label])=>label.startsWith('LOW-DATA MOVING'));
  expect(moving.map(([id])=>id)).toEqual(['hkem-stage','world-map','prayer']);
 });
 it('contains original source imagery without cropping or stretching',()=>{
  expect(fitRect(1920,1080,0,0,720,1280)).toEqual({x:0,y:437.5,width:720,height:405});
  const r=fitRect(1080,1920,20,40,1280,720);expect(r.height).toBe(720);expect(r.width/r.height).toBeCloseTo(1080/1920);expect(r.x).toBeGreaterThan(20);
  expect(fitRect(0,0,0,0,1280,720).width).toBe(0);
 });
 it('mutes confidential intermission microphone audio and always honors explicit mute',()=>{
  const p=normalizePreset({micGain:120});expect(microphoneLevel(p,'camera',false)).toBe(1.2);
  for(const scene of ['starting','break','ending'])expect(microphoneLevel(p,scene,false)).toBe(0);
  expect(microphoneLevel(normalizePreset({muteIntermission:false,micGain:100}),'break',false)).toBe(1);
  expect(microphoneLevel(p,'camera',true)).toBe(0);
 });
 it('rejects unrecognized settings and bounds imported text and mixer levels',()=>{
  const p=normalizePreset({format:'script',destination:'facebook',title:'x'.repeat(999),micGain:10000,mediaGain:-10,mirror:'yes',secret:'private'});
  expect(p.format).toBe('landscape-720');expect(p.destination).toBe('both');expect(p.title.length).toBe(200);expect(p.micGain).toBe(150);expect(p.mediaGain).toBe(0);expect(p.mirror).toBe(false);expect(p).not.toHaveProperty('secret');
 });
 it('ducks background music only while an active microphone is speaking',()=>{
  const p=normalizePreset({musicGain:20});expect(musicLevel(p,.1,true)).toBe(.05);expect(musicLevel(p,.01,true)).toBe(.2);expect(musicLevel(p,.1,false)).toBe(.2);expect(musicLevel(normalizePreset({musicGain:20,duckMusic:false}),.1,true)).toBe(.2);
 });
 it('wraps scripture at readable word boundaries and preserves paragraph breaks',()=>{
  const c={measureText:(text:string)=>({width:text.length*10})};expect(wrapText(c,'Pray without ceasing.\nKeep watch.',100)).toEqual(['Pray','without','ceasing.','Keep','watch.']);
 });
});
