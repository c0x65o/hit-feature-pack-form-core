import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isPublished: z.ZodOptional<z.ZodBoolean>;
    navShow: z.ZodOptional<z.ZodBoolean>;
    navPlacement: z.ZodOptional<z.ZodString>;
    navGroup: z.ZodOptional<z.ZodString>;
    navWeight: z.ZodOptional<z.ZodNumber>;
    navLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    navIcon: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    navParentPath: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    aclEnabled: z.ZodOptional<z.ZodBoolean>;
}, "strip">;
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    isPublished: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    navShow: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    navPlacement: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    navGroup: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    navWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    navLabel: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    navIcon: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    navParentPath: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    aclEnabled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        order: z.ZodOptional<z.ZodNumber>;
        key: z.ZodString;
        label: z.ZodString;
        hidden: z.ZodOptional<z.ZodBoolean>;
        required: z.ZodOptional<z.ZodBoolean>;
        showInTable: z.ZodOptional<z.ZodBoolean>;
        config: z.ZodOptional<z.ZodNullable<z.ZodType<import("drizzle-zod").Json, unknown, z.core.$ZodTypeInternals<import("drizzle-zod").Json, unknown>>>>;
        defaultValue: z.ZodOptional<z.ZodNullable<z.ZodType<import("drizzle-zod").Json, unknown, z.core.$ZodTypeInternals<import("drizzle-zod").Json, unknown>>>>;
    }, "strip">>>;
    draft: z.ZodOptional<z.ZodObject<{
        fields: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            order: z.ZodOptional<z.ZodNumber>;
            key: z.ZodString;
            label: z.ZodString;
            hidden: z.ZodOptional<z.ZodBoolean>;
            required: z.ZodOptional<z.ZodBoolean>;
            showInTable: z.ZodOptional<z.ZodBoolean>;
            config: z.ZodOptional<z.ZodNullable<z.ZodType<import("drizzle-zod").Json, unknown, z.core.$ZodTypeInternals<import("drizzle-zod").Json, unknown>>>>;
            defaultValue: z.ZodOptional<z.ZodNullable<z.ZodType<import("drizzle-zod").Json, unknown, z.core.$ZodTypeInternals<import("drizzle-zod").Json, unknown>>>>;
        }, "strip">>>;
        listConfig: z.ZodOptional<z.ZodAny>;
    }, z.core.$strip>>;
    listConfig: z.ZodOptional<z.ZodAny>;
}, "strip">;
//# sourceMappingURL=forms.schema.d.ts.map