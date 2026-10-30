// Run on the authorized Linux host; never prints or replaces a secret.
import {readFileSync,writeFileSync} from 'node:fs';
import {isIP} from 'node:net';
import {pathToFileURL} from 'node:url';
export function turnConfig({host,publicIP,listenIP,secret}) {
 if(!/^(?=.{1,253}$)[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/i.test(host||'')||!host.includes('.')||host.includes('..'))throw Error('Set TURN_HOST to a DNS hostname');
 if(isIP(publicIP)!==4||isIP(listenIP)!==4)throw Error('Set TURN_PUBLIC_IP and TURN_LISTEN_IP to actual IPv4 addresses');
 if(!/^[A-Za-z0-9_+/=-]{32,256}$/.test(secret||''))throw Error('TURN secret must be 32–256 base64/base64url characters');
 return ['listening-port=3478','listening-ip='+listenIP,'relay-ip='+listenIP,'external-ip='+publicIP+'/'+listenIP,'realm='+host,'server-name='+host,'fingerprint','use-auth-secret','static-auth-secret='+secret,'no-cli','no-multicast-peers','no-tls','no-dtls','no-tcp-relay','min-port=49160','max-port=49200','total-quota=40','user-quota=12','max-bps=1000000','pidfile=/tmp/turnserver.pid','log-file=stdout','simple-log',...['0.0.0.0-0.255.255.255','10.0.0.0-10.255.255.255','100.64.0.0-100.127.255.255','127.0.0.0-127.255.255.255','169.254.0.0-169.254.255.255','172.16.0.0-172.31.255.255','192.168.0.0-192.168.255.255','224.0.0.0-255.255.255.255','::1','fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff','fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'].map(ip=>'denied-peer-ip='+ip)].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
 const secret=readFileSync(process.env.TURN_SECRET_PATH,'utf8').trim();
 const config=turnConfig({host:process.env.TURN_HOST,publicIP:process.env.TURN_PUBLIC_IP,listenIP:process.env.TURN_LISTEN_IP,secret});
 writeFileSync('turnserver.private.conf',config,{mode:0o600,flag:'wx'});
 console.log('Created private TURN configuration. Preserve the matching Worker TURN_SHARED_SECRET.');
 }catch(e){console.error(e.code==='EEXIST'?'Existing TURN configuration preserved.':e.code?'Could not read/write private TURN configuration.':e.message);process.exitCode=1;}
}
