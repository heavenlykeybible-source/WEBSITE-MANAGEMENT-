
import {describe,it,expect,vi} from "vitest";
vi.mock("../../src/services/ministry-command-center-service",()=>({getReminderAccount:vi.fn(),verifyReminderTemplate:vi.fn(),sendReminderTemplate:vi.fn()}));
import {reminderSlot,nextPrayer,validateConfig,runReminders,subscriptionCommand} from "../../src/services/grdpc-service";
import {getReminderAccount} from "../../src/services/ministry-command-center-service";
const config={enabled:false,timingConfirmed:false,phone:"",accountId:null,template:"",language:"en",dailyLimit:100,reminders:[{day:0,time:"19:00"}]};
describe("GRDPC reminders",()=>{
 it("uses Lagos time, including midnight across UTC days",()=>{
 expect(reminderSlot(Date.parse("2026-10-11T18:00:00Z"),config.reminders)?.slot).toBe("2026-10-11T19:00");
 expect(reminderSlot(Date.parse("2026-10-11T23:00:00Z"),[{day:1,time:"00:00"}])?.slot).toBe("2026-10-12T00:00");
 expect(reminderSlot(Date.parse("2026-10-11T17:00:00Z"),config.reminders)).toBeNull();
 });
 it("maps Monday midnight to Sunday night, then advances to next Sunday",()=>{
 expect(nextPrayer(Date.parse("2026-10-11T20:00:00Z")).time).toBe(Date.parse("2026-10-11T23:00:00Z"));
 expect(nextPrayer(Date.parse("2026-10-12T11:00:00Z")).time).toBe(Date.parse("2026-10-18T19:00:00Z"));
 });
 it("cannot activate without timing, connection details, or a bounded budget",()=>{
 expect(()=>validateConfig({...config,enabled:true})).toThrow();
 expect(()=>validateConfig({...config,dailyLimit:0})).toThrow();
 expect(()=>validateConfig({...config,reminders:[{day:1,time:"24:00"}]})).toThrow();
 expect(()=>validateConfig({...config,reminders:[...config.reminders,...config.reminders]})).toThrow();
 expect(validateConfig(config).enabled).toBe(false);
 });
 it("does not send while paused",async()=>{
 const env={DB:{prepare:()=>({first:async()=>({config:JSON.stringify(config)})})}} as any;
 vi.mocked(getReminderAccount).mockClear();await runReminders(env,Date.now());expect(getReminderAccount).not.toHaveBeenCalled();
 });
 it("only explicit subscribe and stop commands change consent",async()=>{
 const runs:any[]=[];const env={PUBLIC_SITE_URL:"https://example.com",DB:{prepare:(sql:string)=>({bind:(...args:any[])=>({run:async()=>{runs.push({sql,args});}}),first:async()=>({config:JSON.stringify(config)})})}} as any;
 expect(await subscriptionCommand(env,"hello",1,"123")).toBeNull();
 await subscriptionCommand(env,"GRDPC",1,"123");expect(runs).toHaveLength(0);
 await subscriptionCommand(env,"GRDPC SUBSCRIBE",1,"123");expect(runs[0].args[2]).toBe("subscribed");
 await subscriptionCommand(env,"GRDPC STOP",1,"123");expect(runs[1].args[2]).toBe("unsubscribed");
 });
});
