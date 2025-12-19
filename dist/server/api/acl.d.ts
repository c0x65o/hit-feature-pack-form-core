import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/forms/[id]/acl
 * List ACLs for a form
 * Requires: admin role OR MANAGE_ACL permission
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
}>>;
/**
 * POST /api/forms/[id]/acl
 * Create ACL entry for a form
 * Requires: admin role OR MANAGE_ACL permission
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
/**
 * DELETE /api/forms/[id]/acl/[aclId]
 * Delete ACL entry
 * Requires: admin role OR MANAGE_ACL permission
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=acl.d.ts.map