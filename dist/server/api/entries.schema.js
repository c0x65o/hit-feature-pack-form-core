import { z } from "zod";
// Schema-only module for:
// - POST /api/forms/[id]/entries
// - PUT /api/forms/[id]/entries/[entryId]
export const postBodySchema = z.object({
    data: z.record(z.string(), z.any()),
});
export const putBodySchema = z.object({
    data: z.record(z.string(), z.any()),
});
//# sourceMappingURL=entries.schema.js.map