import {describe,it,expect} from 'vitest';
import {config,start} from '../../global-community/src/calls';
import {joinGroup,requestConversation,decideGroupRequest,sendMessage} from '../../global-community/src/services';
const db=(rows:any[])=>({prepare:()=>({bind(){return this;},async first(){return rows.shift();},async run(){throw Error('Unexpected mutation');}})});
describe('Social network approval boundaries',()=>{
  it('delivers ordinary approved messages using valid database moderation states',async()=>{
    const writes:any[]=[];
    const env={DB:{prepare(sql:string){let values:any[]=[];return {bind(...args:any[]){values=args;return this;},async first(){if(sql.startsWith('SELECT'))return {status:'accepted',requester_user_id:1,recipient_user_id:2};if(sql.startsWith('INSERT INTO messages')){if(!['allowed','warned','held','blocked'].includes(values[4]))throw Error('Invalid moderation state');writes.push(values);return {message_id:19};}return null;},async run(){return {meta:{changes:1}};}};}}} as any;
    await expect(sendMessage(env,1,4,'Hello in Christ Jesus.')).resolves.toMatchObject({messageId:19,status:'delivered'});
    expect(writes[0][2]).toBe('Hello in Christ Jesus.');
  });
  it('keeps calls disabled until a relay is configured',async()=>{
    expect(await config({} as any,1)).toMatchObject({enabled:false});
    await expect(start({} as any,1,{conversationId:1,mode:'voice'})).rejects.toMatchObject({status:503});
  });
  it('issues expiring relay credentials without disclosing the shared secret',async()=>{
    const env={CALL_TURN_URLS:'turns:relay.example.org:5349',CALL_TURN_SECRET:'test-only-shared-secret'} as any;
    const c=await config(env,17);expect(c.enabled).toBe(true);expect(c.iceServers?.[0].username).toMatch(/^\d+:17$/);expect(c.iceServers?.[0].credential).not.toContain(env.CALL_TURN_SECRET);
    expect(await config({...env,CALL_TURN_URLS:'https://relay.example.org'},17)).toMatchObject({enabled:false});
  });
  it('preserves existing membership rather than overwriting an owner role',async()=>{
    const env={DB:db([{status:'active',visibility:'public'},{join_status:'approved'}])} as any;
    expect(await joinGroup(env,1,2)).toEqual({status:'approved'});
  });
  it('keeps a pending private-group request pending on repeat joins',async()=>{
    const env={DB:db([{status:'active',visibility:'private'},{join_status:'pending'}])} as any;
    expect(await joinGroup(env,1,2)).toEqual({status:'pending'});
  });
  it('blocks new message requests between blocked members',async()=>{
    await expect(requestConversation({DB:db([{exists:1}])} as any,1,2)).rejects.toThrow('unavailable');
  });
  it('does not allow an ordinary member to approve group requests',async()=>{
    await expect(decideGroupRequest({DB:db([null])} as any,1,2,3,true)).rejects.toMatchObject({status:403});
  });
});
