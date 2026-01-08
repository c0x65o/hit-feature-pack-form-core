import { z } from "zod";
// Schema-only module for:
// - PUT /api/forms/[id]
const fieldSchema = z.object({
    id: z.string().uuid().optional(),
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.string().min(1),
    order: z.number().int().optional(),
    hidden: z.boolean().optional(),
    required: z.boolean().optional(),
    config: z.any().nullable().optional(),
    defaultValue: z.any().nullable().optional(),
});
export const putBodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    navShow: z.boolean().optional(),
    navPlacement: z.string().optional(),
    navGroup: z.string().optional(),
    navWeight: z.number().int().optional(),
    navLabel: z.string().nullable().optional(),
    navIcon: z.string().nullable().optional(),
    navParentPath: z.string().nullable().optional(),
    fields: z.array(fieldSchema).optional(),
    draft: z.object({
        fields: z.array(fieldSchema).optional(),
        listConfig: z.any().optional(),
    }).optional(),
    listConfig: z.any().optional(),
});
//# sourceMappingURL=forms-id.schema.js.map