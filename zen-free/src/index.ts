import type { Ctx } from "../../../godwit/sdk/godwit"
import { discoverFreeModels } from "./models"
import { adaptZenRequest } from "./request"

export default function(ctx: Ctx): void {
  ctx.models.register({ listModels: async () => ({ models: await discoverFreeModels(ctx) }), prepareRequest: adaptZenRequest })
}
