import type { Ctx } from "@godwit/sdk"
import { discoverFreeModels, type HTTPModel } from "./models"
import { adaptZenRequest } from "./request"

export default function(ctx: Ctx): void {
  let models: HTTPModel[] = []
  ctx.models.register({
    async listModels() {
      models = await discoverFreeModels(ctx)
      return { models }
    },
    prepareRequest(request) {
      const model = models.find(model => model.id === request.modelId)
      if (!model) throw { code: "invalid_request", message: "Unknown Zen model", retryable: false }
      return adaptZenRequest(request, model.protocol)
    },
  })
}
