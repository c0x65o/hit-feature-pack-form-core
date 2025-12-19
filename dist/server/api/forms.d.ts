import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/forms
 *
 * Two modes:
 * - admin=true: List ALL forms (requires admin role) - for form definition management
 * - default: List forms user has READ ACL for - for nav and entry access
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>>;
/**
 * POST /api/forms
 * Create a new form - requires admin role
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
//# sourceMappingURL=forms.d.ts.map