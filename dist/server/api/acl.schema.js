import { z } from "zod";
// Schema-only module for:
// - POST /api/forms/[id]/acl
const principalTypeEnum = z.enum(["user", "role", "group"]);
const permissionEnum = z.enum(["READ", "WRITE", "MANAGE_ACL"]);
export const postBodySchema = z.object({
    principalType: principalTypeEnum,
    principalId: z.string().min(1),
    permissions: z.array(permissionEnum).min(1),
});
//# sourceMappingURL=acl.schema.js.map