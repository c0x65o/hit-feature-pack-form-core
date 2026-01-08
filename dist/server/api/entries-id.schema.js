import { z } from "zod";
// Schema-only module for:
// - PUT /api/forms/[id]/entries/[entryId]
export const putBodySchema = z.object({
    data: z.record(z.string(), z.any()),
});
//# sourceMappingURL=entries-id.schema.js.map