import type { ModelHTTPRequest, PrepareModelRequest } from "../../../godwit/sdk/godwit"
import { BASE } from "./models"

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
function tail(seed: string): string {
  let result = ""
  for (let i = 0; i < 14; i++) {
    let hash = 2166136261
    for (let j = 0; j < seed.length; j++) hash = Math.imul(hash ^ seed.charCodeAt(j), 16777619)
    hash = Math.imul(hash ^ i, 16777619) >>> 0
    result += alphabet[hash % 62]
  }
  return result
}
function identifier(prefix: string, descending: boolean, now: number, counter: number, seed: string): string {
  const stamp = (Math.floor(now) % 0x1000000000) * 4096 + counter
  const hex = (descending ? 0xffffffffffff - stamp : stamp).toString(16).padStart(12, "0")
  return prefix + "_" + hex + tail(seed)
}
export function sessionID(id: string, createdAt: number): string { return identifier("ses", true, createdAt, 1, id) }
let stamp = 0, counter = 0
const paths: Record<string, string> = { "openai-completions": "/chat/completions", "openai-responses": "/responses", "anthropic-message": "/messages", "typesafe-systemone": "/systemone", "openai-decisions": "/decisions" }
const versions: Record<string, string> = { "openai-completions": "4.0.23", "openai-responses": "4.0.40", "anthropic-message": "4.0.46" }
const coreParameters: Record<string, string> = { bash: "command", edit: "filePath", glob: "pattern", grep: "pattern", read: "filePath" }
export function adaptZenRequest(call: PrepareModelRequest): ModelHTTPRequest {
  const protocol = call.model.protocol
  if (!paths[protocol]) throw { code: "invalid_request", message: "Unsupported Zen protocol", retryable: false }
  const body = JSON.parse(JSON.stringify(call.request.body))
  if (versions[protocol]) {
    if (body.tools !== undefined && !Array.isArray(body.tools)) throw { code: "invalid_request", message: "Invalid tools", retryable: false }
    body.tools ??= []
    const present = new Set(body.tools.map((tool: any) => protocol === "openai-completions" ? tool?.function?.name : tool?.name))
    if (protocol === "openai-completions" && Array.isArray(body.functions)) for (const tool of body.functions) present.add(tool?.name)
    for (const name of Object.keys(coreParameters)) {
      if (present.has(name)) continue
      const parameters = { type: "object", properties: { [coreParameters[name]]: { type: "string" } }, additionalProperties: false }
      const definition = { name, description: "Not available. Never call this tool." }
      body.tools.push(protocol === "openai-completions" ? { type: "function", function: { ...definition, parameters } } : protocol === "anthropic-message" ? { ...definition, input_schema: parameters } : { type: "function", ...definition, parameters })
    }
    if (protocol === "openai-completions") body.stream_options = { ...body.stream_options, include_usage: true }
  }
  const now = Date.now()
  if (now !== stamp) { stamp = now; counter = 0 }
  counter = (counter + 1) % 4096
  const session = sessionID(call.sessionId, call.sessionCreatedAt)
  const headers: Record<string, string> = {
    "content-type": "application/json", accept: "*/*",
    "user-agent": `opencode/1.19.0 ai-sdk/provider-utils/${versions[protocol] || "4.0.23"} runtime/bun/1.3.14`,
    "x-opencode-project": "global", "x-opencode-client": "cli",
    "x-opencode-session": session, "x-opencode-session-id": session,
    "x-opencode-request": identifier("msg", false, now, counter, call.requestId),
  }
  if (protocol === "anthropic-message") {
    headers["x-api-key"] = "public"
    headers["anthropic-version"] = "2023-06-01"
    const beta = Object.keys(call.request.headers).find(k => k.toLowerCase() === "anthropic-beta")
    if (beta) headers["anthropic-beta"] = call.request.headers[beta]
  } else headers.authorization = "Bearer public"
  return { url: BASE + paths[protocol], headers, body }
}
