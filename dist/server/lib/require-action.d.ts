import { NextRequest, NextResponse } from 'next/server';
type ActionCheckResult = {
    ok: boolean;
    source?: string;
};
type ActionCheckOptions = {
    /**
     * When true, log all checks/results to console.
     * When false (default), log only error conditions (no token / auth unreachable / non-2xx).
     * You can also enable globally via DEBUG_FORM_CORE_AUTHZ=1.
     */
    debug?: boolean;
};
export declare function checkFormCoreAction(request: NextRequest, actionKey: string, options?: ActionCheckOptions): Promise<ActionCheckResult>;
export declare function requireFormCoreAction(request: NextRequest, actionKey: string): Promise<NextResponse | null>;
export {};
//# sourceMappingURL=require-action.d.ts.map