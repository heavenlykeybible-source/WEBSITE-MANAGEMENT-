import assert from 'node:assert/strict';import fs from 'node:fs';import {improveCodingChat} from '../cms/chat-productivity.mjs';
const original=fs.readFileSync('control-room-worker.js','utf8');let result=original;for(let i=0;i<5;i++)result=improveCodingChat(result);
assert.equal((result.match(/Coding and website standard:/g)||[]).length,1);assert.equal((original.match(/Coding and website standard:/g)||[]).length,1);console.log('PASS repeated builds keep one coding prompt, preventing runaway AI request size');
