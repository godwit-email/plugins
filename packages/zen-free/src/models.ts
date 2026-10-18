import type { Ctx, Model } from "@godwit/sdk"

export type HTTPModel = Extract<Model, { transport: "http" }>
export type ModelProtocol = HTTPModel["protocol"]

export const BASE = "https://opencode.ai/inference/v1"
const CATALOG = "https://models.opencode.ai/api.json"
const DOCS = "https://raw.githubusercontent.com/anomalyco/opencode/dev/services/www/src/docs/content/console/models.mdx"
type DocModel = { name: string; protocol: ModelProtocol; free?: boolean }
type Metadata = { npm?: string; models?: Record<string, any> }
const protocols: Record<string, ModelProtocol> = {
  "chat/completions": "openai-completions", responses: "openai-responses",
  messages: "anthropic-message", systemone: "typesafe-systemone", decisions: "openai-decisions",
}
// Add a judge only after its public-credential request passes a real host test.
export const validatedJudgeModels: string[] = ["jev-1.13-free"]

export function parseDocs(text: string): Record<string, DocModel> {
  const result: Record<string, DocModel> = Object.create(null)
  const pricing: Record<string, boolean> = Object.create(null)
  for (const line of text.split("\n")) {
    const cells = line.split("|").slice(1, -1).map(c => c.trim().replace(/`/g, ""))
    if (cells.length < 3) continue
    const endpoint = (cells[2] || "").match(/^https:\/\/opencode\.ai\/[^\s]*\/v1\/(chat\/completions|responses|messages|systemone|decisions)$/)
    if (endpoint && cells[1] && !/\s/.test(cells[1])) {
      result[cells[1]] = { name: cells[0], protocol: protocols[endpoint[1]] }
    } else if (/^(free|\$)/i.test(cells[1]) && /^(free|\$)/i.test(cells[2])) {
      pricing[cells[0].toLowerCase()] = /^free$/i.test(cells[1]) && /^free$/i.test(cells[2])
    }
  }
  for (const id of Object.keys(result)) result[id].free = pricing[result[id].name.toLowerCase()]
  return result
}

export function buildModels(ids: string[], provider: Metadata, docs: Record<string, DocModel>): HTTPModel[] {
  const result: HTTPModel[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (!id || id === "__proto__" || seen.has(id)) continue
    seen.add(id)
    const raw = provider.models?.[id]
    const doc = docs[id]
    if (raw && (raw.deprecated === true || ["deprecated", "retired", "disabled"].includes(raw.status ?? raw.lifecycle) || raw.deprecated_at != null || raw.retirement_date != null)) continue
    const cost = raw?.cost
    if ((cost && (cost.input !== 0 || cost.output !== 0)) || doc?.free === false) continue
    if (!(cost?.input === 0 && cost?.output === 0) && doc?.free !== true) continue
    const npm = raw?.provider?.npm ?? (raw ? provider.npm : undefined)
    const protocol = doc?.protocol ?? (npm === "@ai-sdk/openai" ? "openai-responses" : npm?.includes("anthropic") ? "anthropic-message" : npm?.includes("openai-compatible") ? "openai-completions" : undefined)
    if (!protocol) continue
    if ((protocol === "typesafe-systemone" || protocol === "openai-decisions") && !validatedJudgeModels.includes(id)) continue
    result.push({ id, name: raw?.name || doc?.name || id, transport: "http", protocol, baseURL: BASE })
  }
  return result
}

let lastProvider: Metadata = {}
let lastDocs: Record<string, DocModel> = {}
let providerAt = 0, docsAt = 0
const recent = 60 * 60 * 1000
const upstream = () => ({ code: "upstream", message: "Zen Free model discovery is unavailable; retry later.", retryable: true })
export async function discoverFreeModels(ctx: Ctx): Promise<HTTPModel[]> {
  const read = async (url: string) => {
    const response = await ctx.net.fetch(url, url === BASE + "/models" ? { headers: { authorization: "Bearer public", "x-opencode-client": "cli" } } : undefined)
    if (response.status !== 200) throw upstream()
    return response.text()
  }
  const [listing, catalog, document] = await Promise.allSettled([read(BASE + "/models"), read(CATALOG), read(DOCS)])
  if (listing.status !== "fulfilled") throw upstream()
  let ids: string[]
  try {
    const data = JSON.parse(listing.value).data
    if (!Array.isArray(data) || data.some(m => !m || typeof m.id !== "string")) throw upstream()
    ids = data.map(m => m.id)
  } catch { throw upstream() }
  if (!ids.length) return []
  const now = Date.now()
  if (catalog.status === "fulfilled") {
    try { const p = JSON.parse(catalog.value).opencode; if (p?.models && typeof p.models === "object") { lastProvider = p; providerAt = now } } catch { /* retain recent trusted metadata */ }
  }
  if (document.status === "fulfilled") {
    const parsed = parseDocs(document.value)
    if (Object.keys(parsed).length) { lastDocs = parsed; docsAt = now }
  }
  const provider = now - providerAt < recent ? lastProvider : {}
  const docs = now - docsAt < recent ? lastDocs : {}
  if (!Object.keys(provider).length && !Object.keys(docs).length) throw upstream()
  return buildModels(ids, provider, docs)
}
