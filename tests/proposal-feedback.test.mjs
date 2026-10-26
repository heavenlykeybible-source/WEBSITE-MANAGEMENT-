import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync('control-room-worker.js','utf8');
const script=source.slice(source.indexOf('function proposalDecisionMessage('),source.indexOf('function proposalDecisionNotice('));
const context={};vm.runInNewContext(script,context);const message=context.proposalDecisionMessage;
test('Approval alone never claims successful deployment',()=>{const text=message('worker',{status:'approved'});assert.match(text,/approved/);assert.match(text,/not yet confirmed/);assert.doesNotMatch(text,/has been deployed/)});
test('Confirmed worker deployment has a distinct success message',()=>{assert.match(message('worker',{status:'approved',release_status:'succeeded'}),/Worker has been deployed/)});
test('GitHub save does not claim a live website',()=>{const text=message('github',{status:'approved',release_status:'succeeded'});assert.match(text,/saved to GitHub/);assert.match(text,/deployment is not yet confirmed/)});
test('Rejection and changes requested remain distinct from approval',()=>{assert.match(message('worker',{status:'rejected'}),/declined/);assert.match(message('worker',{status:'changes_requested'}),/Changes requested/);assert.match(message('worker',{status:'uncertain'}),/verification/)});
test('Failure recovery checks state without repeating a write',()=>{const notice=source.slice(source.indexOf('function proposalDecisionNotice('),source.indexOf('\n}\n',source.indexOf('function proposalDecisionNotice('))+2);assert.match(notice,/Check result/);assert.match(notice,/api\('proposals\/'\+id\)/);assert.doesNotMatch(notice,/decide.*POST/);assert.match(notice,/textContent|h\('p',\{\},message\)/)});
