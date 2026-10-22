import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function harness(handler) {
  const nodes=new Map(),events={};
  const element=id=>({id,hidden:false,disabled:false,value:'',textContent:'',children:[],listeners:{},attributes:{},
    addEventListener(name,fn){this.listeners[name]=fn},setAttribute(n,v){this.attributes[n]=v},replaceChildren(){this.children=[]},append(...items){this.children.push(...items)}});
  for(const id of ['connect-member','member-login','member-status','member-account','member-name','member-logout','member-learning','load-member-tracks','member-tracks-list','member-tracks-status','member-email','member-password','member-submit'])nodes.set(id,element(id));
  for(const id of ['member-login','member-account','member-learning'])nodes.get(id).hidden=true;
  const calls=[];
  vm.runInNewContext(readFileSync(new URL('../public/member.js',import.meta.url),'utf8'),{
    document:{getElementById:id=>nodes.get(id),createElement:tag=>element(tag)},
    window:{addEventListener:(name,fn)=>events[name]=fn},AbortController,setTimeout,clearTimeout,
    fetch:async(path,options)=>{calls.push({path,options});return handler(path,options);},
    localStorage:{setItem(){throw Error('Never store member data');}},sessionStorage:{setItem(){throw Error('Never store member data');}}
  });
  return {nodes,events,calls};
}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const me={member:{displayName:'A believer',status:'active'}};

test('disabled connection never exposes password inputs and never calls sign-in',async()=>{
  const h=harness(()=>response({enabled:false}));assert.equal(h.calls.length,0);
  await h.nodes.get('connect-member').listeners.click();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/member/config');
  assert.equal(h.nodes.get('member-login').hidden,true);assert.match(h.nodes.get('member-status').textContent,/still being tested/);
});
test('existing member sign-in loads profile without storing credentials',async()=>{
  let logged=false;
  const h=harness((path,options)=>{
    assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
    if(path.endsWith('config'))return response({enabled:true});
    if(path.endsWith('session'))return logged?response(me):response({error:'Please sign in.'},401);
    if(path.endsWith('login')){logged=true;assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{email:'member@example.test',password:'secret'});return response({ok:true});}
    throw Error('Unexpected '+path);
  });
  await h.nodes.get('connect-member').listeners.click();assert.equal(h.nodes.get('member-login').hidden,false);
  h.nodes.get('member-email').value='member@example.test';h.nodes.get('member-password').value='secret';
  await h.nodes.get('member-login').listeners.submit({preventDefault(){}});
  assert.equal(h.nodes.get('member-password').value,'');assert.equal(h.nodes.get('member-name').textContent,'A believer');
  assert.equal(h.nodes.get('member-learning').hidden,false);assert.equal(h.nodes.get('member-account').hidden,false);assert.equal(h.nodes.get('member-login').hidden,true);
});
test('failed sign-in clears the password and permits a retry',async()=>{
  const h=harness(path=>path.endsWith('config')?response({enabled:true}):response({error:'Please sign in.'},401));
  await h.nodes.get('connect-member').listeners.click();h.nodes.get('member-password').value='secret';
  await h.nodes.get('member-login').listeners.submit({preventDefault(){}});
  assert.equal(h.nodes.get('member-password').value,'');assert.equal(h.nodes.get('member-submit').disabled,false);
  assert.equal(h.nodes.get('member-account').hidden,true);
});
test('lesson completion is confirmed upstream, reflects failure and clears private data on logout',async()=>{
  let fail=true;
  const h=harness(path=>{
    if(path.endsWith('config'))return response({enabled:true});
    if(path.endsWith('session'))return response(me);
    if(path.endsWith('tracks'))return response({items:[{title:'Foundations',lessons:[{id:8,title:'Follow Christ',body:'<script>alert(1)</script>',completed:false}]}]});
    if(path.endsWith('complete'))return fail?response({error:'Try again'},502):response({completed:true});
    if(path.endsWith('logout'))return response({ok:true});throw Error(path);
  });
  await h.nodes.get('connect-member').listeners.click();await h.nodes.get('load-member-tracks').listeners.click();
  const lesson=h.nodes.get('member-tracks-list').children[0].children[1];
  assert.equal(lesson.children[1].textContent,'<script>alert(1)</script>');assert.equal(lesson.children[1].innerHTML,undefined);
  const reflection=lesson.children.find(x=>x.id==='reflection-8'),button=lesson.children.find(x=>x.id==='button'),result=lesson.children.at(-1);
  reflection.value='A personal reflection';await button.listeners.click();assert.equal(button.disabled,false);assert.equal(result.textContent,'Try again');assert.equal(reflection.value,'A personal reflection');
  fail=false;await button.listeners.click();assert.equal(button.disabled,true);assert.equal(reflection.value,'');assert.match(result.textContent,/Saved to your existing/);
  await h.nodes.get('member-logout').listeners.click();assert.equal(h.nodes.get('member-name').textContent,'');assert.equal(h.nodes.get('member-tracks-list').children.length,0);assert.equal(h.nodes.get('member-learning').hidden,true);
});
test('expired sessions and page restoration clear private lesson content',async()=>{
  const h=harness(path=>path.endsWith('config')?response({enabled:true}):path.endsWith('session')?response(me):response({error:'Please sign in.'},401));
  await h.nodes.get('connect-member').listeners.click();await h.nodes.get('load-member-tracks').listeners.click();
  assert.equal(h.nodes.get('member-account').hidden,true);assert.equal(h.nodes.get('member-name').textContent,'');
  await h.nodes.get('connect-member').listeners.click();h.events.pageshow({persisted:true});
  assert.equal(h.nodes.get('member-account').hidden,true);assert.equal(h.nodes.get('member-name').textContent,'');assert.match(h.nodes.get('member-status').textContent,/Reconnect/);
});
test('a lesson request completing after sign-out cannot restore private content',async()=>{
  let release;
  const h=harness(path=>path.endsWith('config')?response({enabled:true}):path.endsWith('session')?response(me):path.endsWith('logout')?response({ok:true}):new Promise(resolve=>release=()=>resolve(response({items:[{title:'Private',lessons:[]}]}))));
  await h.nodes.get('connect-member').listeners.click();const pending=h.nodes.get('load-member-tracks').listeners.click();
  await h.nodes.get('member-logout').listeners.click();release();await pending;
  assert.equal(h.nodes.get('member-tracks-list').children.length,0);assert.equal(h.nodes.get('member-learning').hidden,true);
});
