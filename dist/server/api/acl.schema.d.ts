import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    principalType: z.ZodEnum<{
        role: "role";
        user: "user";
        group: "group";
    }>;
    principalId: z.ZodString;
    permissions: z.ZodArray<z.ZodEnum<{
        READ: "READ";
        WRITE: "WRITE";
        MANAGE_ACL: "MANAGE_ACL";
    }>>;
}, z.core.$strip>;
//# sourceMappingURL=acl.schema.d.ts.map