import {expect, test} from "bun:test"
import type {ModelRequest} from "@godwit/sdk"
import {adaptZenRequest} from "./request"

for (const protocol of ["openai-completions", "openai-responses", "anthropic-message"] as const) {
  test(protocol + " adapts the SDK's JSON text and preserves real tools", () => {
    const real = protocol === "openai-completions"
      ? {type: "function", function: {name: "read", parameters: {type: "object", properties: {path: {type: "string"}}}}}
      : protocol === "anthropic-message"
        ? {name: "read", input_schema: {type: "object"}}
        : {type: "function", name: "read", parameters: {type: "object"}}
    const request: ModelRequest = {
      modelId: "free", method: "POST", url: "https://opencode.ai/inference/v1/unused",
      headers: {Authorization: "Bearer secret", "Anthropic-Beta": "test-beta"},
      body: JSON.stringify({model: "free", stream: true, messages: [{role: "user", content: "hi"}], tools: [real]}),
    }
    const before = JSON.stringify(request)
    const a = adaptZenRequest(request, protocol)
    const b = adaptZenRequest(request, protocol)
    const body = JSON.parse(a.body)
    expect(JSON.stringify(request)).toBe(before)
    expect(body.model).toBe("free")
    expect(body.messages).toEqual([{role: "user", content: "hi"}])
    expect(body.tools[0]).toEqual(real)
    expect(body.tools).toHaveLength(5)
    const path = protocol === "openai-completions" ? "chat/completions" : protocol === "openai-responses" ? "responses" : "messages"
    expect(a.url).toBe("https://opencode.ai/inference/v1/" + path)
    expect(a.headers["x-opencode-session"]).toBe(b.headers["x-opencode-session"])
    expect(a.headers["x-opencode-request"]).not.toBe(b.headers["x-opencode-request"])
    expect(a.headers["x-opencode-session"]).toMatch(/^ses_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(a.headers["x-opencode-request"]).toMatch(/^msg_[0-9a-f]{12}[0-9A-Za-z]{14}$/)
    expect(JSON.stringify(a.headers)).not.toContain("secret")
    expect(a.headers[protocol === "anthropic-message" ? "x-api-key" : "authorization"]).toBe(protocol === "anthropic-message" ? "public" : "Bearer public")
    if (protocol === "anthropic-message") expect(a.headers["anthropic-beta"]).toBe("test-beta")
    if (protocol === "openai-completions") expect(body.stream_options.include_usage).toBe(true)
  })
}

test("judge request keeps its payload without adding generation tools", () => {
  const request: ModelRequest = {
    modelId: "jev-1.13-free", method: "POST", url: "https://opencode.ai/inference/v1/systemone",
    headers: {}, body: '{"model":"jev-1.13-free","input":"blue","questions":{"blue":{"type":"noul","predicate":"Is it blue?"}}}',
  }
  const prepared = adaptZenRequest(request, "typesafe-systemone")
  expect(prepared.url).toBe(request.url)
  expect(JSON.parse(prepared.body)).toEqual(JSON.parse(request.body))
  expect(prepared.headers.authorization).toBe("Bearer public")
})
