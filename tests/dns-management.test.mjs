import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
const server=fs.readFileSync('workspace/imports.js','utf8');
const client=fs.readFileSync('workspace/client.js','utf8');
const start=server.indexOf('function dnsRecordInput('),end=server.indexOf('async function dnsCloudflare(',start);
assert.ok(start>=0&&end>start,'DNS validator exists');
const validate=runInNewContext('('+server.slice(start,end).trim()+')',{fail:(msg)=>{throw Error(msg)}});
test('DNS validator accepts valid IPv4 and CNAME records',()=>{
 assert.equal(validate({name:'browser',type:'A',target:'8.8.8.8'}).name,'browser.heavenlykey.org');
 assert.equal(validate({name:'browser',type:'CNAME',target:'service.example.com'}).content,'service.example.com');
});
test('DNS validator rejects malformed addresses and unauthorized names',()=>{
 for(const target of ['256.1.1.1','1.2.3','01.2.3.4','1.2.3.4x','127.0.0.1:80','203.0.113.12','10.1.2.3','192.168.1.1'])assert.throws(()=>validate({name:'browser',type:'A',target}));
 for(const name of ['*.example','a.b','-browser','browser-',''])assert.throws(()=>validate({name,type:'A',target:'8.8.8.8'}));
});
test('DNS changes require owner approval and audit logging',()=>{
 assert.match(server,/user\.role!=='owner'/);
 assert.match(server,/workspace\/dns\/propose-create/);
 assert.match(server,/workspace\/dns\/approve-create/);
 assert.match(server,/input\?\.confirm!==p\.record\.name/);
 assert.match(server,/withOperationLock\(env,'dns-create:'/);
 assert.match(server,/dns-create-approved/);
 assert.match(server,/needs-reconciliation/);
});
test('DNS token is server-side and interface does not accept token input',()=>{
 assert.match(server,/env\.DNS_API_TOKEN/);
 assert.doesNotMatch(client,/DNS_API_TOKEN.*value/);
 assert.match(client,/workspace\/dns\/verify-permission/);
 assert.match(client,/workspace\/dns\/propose-create/);
 assert.match(client,/workspace\/dns\/approve-create/);
});
