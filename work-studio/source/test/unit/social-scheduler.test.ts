import { describe, expect, it } from "vitest";
import { checkSocialPublishCompatibility, checkSocialCaption } from "../../src/services/social-management-service";

describe("social publishing destination safeguards", () => {
 it("accepts Facebook picture publishing and text posts", () => {
  expect(() => checkSocialPublishCompatibility("facebook","image",1,true)).not.toThrow();
  expect(() => checkSocialPublishCompatibility("facebook","",0,true)).not.toThrow();
 });
 it("accepts one Instagram picture but not text-only content", () => {
  expect(() => checkSocialPublishCompatibility("instagram","image",1,true)).not.toThrow();
  expect(() => checkSocialPublishCompatibility("instagram","",0,true)).toThrow();
 });
 it("rejects photos for TikTok and YouTube until enabled", () => {
  expect(() => checkSocialPublishCompatibility("tiktok","image",1,true)).toThrow();
  expect(() => checkSocialPublishCompatibility("youtube","image",1,true)).toThrow();
  expect(() => checkSocialPublishCompatibility("tiktok","video",1,true)).toThrow("not certified");
  expect(() => checkSocialPublishCompatibility("youtube","video",1,true)).not.toThrow();
 });
 it("rejects images on text-only X and LinkedIn integrations", () => {
  for(const platform of ["x","linkedin"]){
   expect(() => checkSocialPublishCompatibility(platform,"image",1,true)).toThrow();
   expect(() => checkSocialPublishCompatibility(platform,"",0,true)).not.toThrow();
  }
 });
 it("never silently ignores extra uploaded photos", () => {
  expect(() => checkSocialPublishCompatibility("facebook","image",2,true)).toThrow("one picture");
 });
 it("rejects unsupported media type and empty post", () => {
  expect(() => checkSocialPublishCompatibility("facebook","audio",1,true)).toThrow();
  expect(() => checkSocialPublishCompatibility("facebook","",0,false)).toThrow();
 });
 it("rejects captions exceeding documented platform sizes",()=>{
  expect(() => checkSocialCaption("x","a".repeat(281))).toThrow("280");
  expect(() => checkSocialCaption("instagram","a".repeat(2201))).toThrow("2,200");
  expect(() => checkSocialCaption("youtube","a".repeat(5001))).toThrow("5,000");
  expect(() => checkSocialCaption("facebook","a".repeat(5001))).not.toThrow();
 });

});
