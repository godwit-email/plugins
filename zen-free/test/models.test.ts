import {describe,expect,test} from "bun:test"
import {buildModels,discoverFreeModels,parseDocs} from "../src/models"
const docs=`| Name | Model | Endpoint | SDK |
| Free | free | \`https://opencode.ai/inference/openai/v1/responses\` | sdk |
| Pickle | pickle | \`https://opencode.ai/inference/openai/v1/chat/completions\` | sdk |
| Claude | claude | \`https://opencode.ai/inference/anthropic/v1/messages\` | sdk |
| Name | Input | Output |
| Free | Free | Free |
| Pickle | Free | Free |
| Claude | Free | Free |`
describe("discovery",()=>{
 test("protocols and current free pricing",()=>{const parsed=parseDocs(docs);expect(parsed.free.protocol).toBe("openai-responses");expect(parsed.claude.protocol).toBe("anthropic-message");expect(buildModels(["free","pickle","claude","unknown"],{},parsed).map(m=>m.id)).toEqual(["free","pickle","claude"])})
 test("paid and retired win over free names/docs",()=>{expect(buildModels(["paid-free","retired","free"],{npm:"@ai-sdk/openai-compatible",models:{"paid-free":{cost:{input:1,output:1}},retired:{status:"deprecated",cost:{input:0,output:0}},free:{retirement_date:"2026-10-01",cost:{input:0,output:0}}}},parseDocs(docs))).toEqual([])})
 test("unknown protocol is omitted",()=>{expect(buildModels(["x"],{models:{x:{cost:{input:0,output:0}}}},{})).toEqual([])})
 test("live list failure is a business error, empty list stays empty",async()=>{
 const ctx={net:{fetch:async(url:string)=>({status:url.endsWith("/models")?503:200,text:async()=>"{}"})}} as any
 await expect(discoverFreeModels(ctx)).rejects.toMatchObject({code:"upstream"})
 ctx.net.fetch=async(url:string)=>({status:200,text:async()=>url.endsWith("/models")?'{"data":[]}':"{}"})
 expect(await discoverFreeModels(ctx)).toEqual([])
 })
 test("current docs work when oversized metadata cannot be fetched",async()=>{
 const ctx={net:{fetch:async(url:string)=>{if(url.includes("api.json"))throw new Error("too large");return {status:200,text:async()=>url.endsWith("/models")?'{"data":[{"id":"free"},{"id":"paid"}]}':docs}}}} as any
 expect((await discoverFreeModels(ctx)).map(m=>m.id)).toEqual(["free"])
 })
})

test("only the verified free judge is discoverable",()=>{const text="| Jev Free | jev-1.13-free | `https://opencode.ai/inference/systemone/v1/systemone` | - |\n| Unknown Free | other-free | `https://opencode.ai/inference/systemone/v1/systemone` | - |\n| Jev Free | Free | Free |\n| Unknown Free | Free | Free |";expect(buildModels(["jev-1.13-free","other-free"],{},parseDocs(text)).map(m=>m.id)).toEqual(["jev-1.13-free"])})
