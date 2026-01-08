import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/forms/[id]
 * Get a form with its current draft version and fields
 * Requires: admin role OR READ ACL
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    form: any;
    version: any;
}>>;
/**
 * PUT /api/forms/[id]
 * Update form metadata and fields
 * Requires: admin role (for form definitions)
 */
export declare function PUT(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    form: any;
    version: any;
}>>;
/**
 * DELETE /api/forms/[id]
 * Delete form and all related data (versions, fields, entries, history, ACLs)
 * Requires: admin role
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=forms-id.d.ts.map