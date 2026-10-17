import {expect,test} from "bun:test"
import type {JSONValue} from "@godwit/sdk"
import {adaptZenRequest,sessionID} from "./request"
for(const protocol of ["openai-completions","openai-responses","anthropic-message"]){test(protocol+" preserves real tools and input",()=>{
 const real:JSONValue=protocol==="openai-completions"?{type:"function",function:{name:"read",parameters:{type:"object",properties:{path:{type:"string"}}}}}:protocol==="anthropic-message"?{name:"read",input_schema:{type:"object"}}:{type:"function",name:"read",parameters:{type:"object"}}
 const call={model:{id:"free",name:"Free",transport:"http",protocol,baseURL:"https://opencode.ai/inference/v1"},sessionId:"random-host-session",sessionCreatedAt:1792240000000,requestId:"attempt-one",request:{url:"ignored",headers:{"Authorization":"Bearer secret"},body:{model:"free",stream:true,tools:[real]}}} as any
 const before=JSON.stringify(call);const a=adaptZenRequest(call);const b=adaptZenRequest({...call,requestId:"attempt-two"})
 const tools=a.body.tools
 if(!Array.isArray(tools))throw new Error("prepared request must contain a tools array")
 expect(JSON.stringify(call)).toBe(before);expect(tools[0]).toEqual(real);expect(tools.length).toBe(5)
 expect(a.headers["x-opencode-session"]).toBe(b.headers["x-opencode-session"]);expect(a.headers["x-opencode-request"]).not.toBe(b.headers["x-opencode-request"])
 expect(a.headers["x-opencode-session"]).toMatch(/^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
 expect(4095-parseInt(a.headers["x-opencode-session"].slice(13,16),16)).toBeLessThan(16)
 expect(JSON.stringify(a.headers)).not.toContain("secret");expect(a.headers[protocol==="anthropic-message"?"x-api-key":"authorization"]).toBe(protocol==="anthropic-message"?"public":"Bearer public")
 })}
test("session is stable without VM memory",()=>{expect(sessionID("random",1792240000000)).toBe(sessionID("random",1792240000000));expect(sessionID("other",1792240000000)).not.toBe(sessionID("random",1792240000000))})
