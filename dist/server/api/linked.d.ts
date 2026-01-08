import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/forms/linked?entityKind=project&entityId=...
 *
 * Returns all published forms the user can READ which contain an entity_reference field
 * targeting entityKind, along with a per-field linked-entry count for entityId.
 *
 * This is intended to power "dynamic tabs" across any entity page (projects/companies/etc).
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: {
        formId: string;
        formName: string;
        formSlug: string;
        entityFieldKey: string;
        count: number;
    }[];
}>>;
//# sourceMappingURL=linked.d.ts.map