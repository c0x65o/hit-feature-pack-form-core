import { createInsertSchema } from "drizzle-zod";
import { forms, formFields } from "../../schema/forms";
import { z } from "zod";
// Schema-only module for:
// - POST /api/forms
// - PUT /api/forms/[id]
// Derive base form schema from Drizzle table, then omit server-controlled fields
const baseFormSchema = createInsertSchema(forms, {
    id: z.string().optional(), // Allow omitting (will be generated)
    ownerUserId: z.string().optional(), // Server-controlled (from auth)
    createdAt: z.any().optional(), // Server-controlled
    updatedAt: z.any().optional(), // Server-controlled
});
// Derive field schema from formFields table (omit formId, versionId, and audit fields)
const fieldSchema = createInsertSchema(formFields, {
    id: z.string().optional(),
    formId: z.string().optional(), // Set by handler
    versionId: z.string().optional(), // Set by handler
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
}).omit({
    id: true,
    formId: true,
    versionId: true,
    createdAt: true,
    updatedAt: true,
});
export const postBodySchema = baseFormSchema.omit({
    id: true,
    ownerUserId: true,
    createdAt: true,
    updatedAt: true,
});
export const putBodySchema = baseFormSchema
    .omit({
    id: true,
    ownerUserId: true,
    createdAt: true,
    updatedAt: true,
})
    .partial()
    .extend({
    // Fields are stored in formFields table (via formVersions)
    fields: z.array(fieldSchema).optional(),
    // Draft is stored in formVersions with status='draft'
    draft: z.object({
        fields: z.array(fieldSchema).optional(),
        listConfig: z.any().optional(),
    }).optional(),
    // listConfig is stored in formVersions
    listConfig: z.any().optional(),
});
//# sourceMappingURL=forms.schema.js.map