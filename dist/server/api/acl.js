// src/server/api/acl.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formsAcls, forms } from '@/lib/feature-pack-schemas';
import { eq, desc, and, or } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { FORM_PERMISSIONS } from '../../schema/forms';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * Extract form ID from URL path
 * Supports: /api/forms/{id}/acl and /api/forms/{id}/acl/{aclId}
 */
function extractFormId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    // Find 'forms' and get the next segment
    const formsIndex = parts.indexOf('forms');
    if (formsIndex >= 0 && formsIndex + 1 < parts.length) {
        return parts[formsIndex + 1];
    }
    return null;
}
function extractAclId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    // /api/forms/{id}/acl/{aclId} -> aclId is last
    const aclIndex = parts.indexOf('acl');
    if (aclIndex >= 0 && aclIndex + 1 < parts.length) {
        return parts[aclIndex + 1];
    }
    return null;
}
/**
 * Check if user is admin
 */
function isAdmin(roles) {
    return roles.includes('admin') || roles.includes('Admin');
}
/**
 * Check if user can manage ACLs (admin or has MANAGE_ACL permission)
 */
async function canManageAcls(db, formId, userId, roles) {
    // Admins can always manage ACLs
    if (isAdmin(roles))
        return true;
    // Check ACL entries for MANAGE_ACL permission
    const principalIds = [userId, ...roles].filter(Boolean);
    if (principalIds.length === 0)
        return false;
    const aclEntries = await db
        .select()
        .from(formsAcls)
        .where(and(eq(formsAcls.formId, formId), or(...principalIds.map((id) => eq(formsAcls.principalId, id)))));
    if (aclEntries.length === 0)
        return false;
    const allPermissions = aclEntries.flatMap((e) => e.permissions || []);
    return allPermissions.includes(FORM_PERMISSIONS.MANAGE_ACL);
}
/**
 * GET /api/forms/[id]/acl
 * List ACLs for a form
 * Requires: admin role OR MANAGE_ACL permission
 */
export async function GET(request) {
    try {
        const db = getDb();
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const formId = extractFormId(request);
        if (!formId) {
            return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
        }
        // Check form exists
        const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
        if (!form) {
            return NextResponse.json({ error: 'Form not found' }, { status: 404 });
        }
        // Check access
        const hasAccess = await canManageAcls(db, formId, user.sub, user.roles || []);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        const items = await db
            .select()
            .from(formsAcls)
            .where(eq(formsAcls.formId, formId))
            .orderBy(desc(formsAcls.createdAt));
        return NextResponse.json({ items });
    }
    catch (error) {
        console.error('[forms] List ACL error:', error);
        return NextResponse.json({ error: 'Failed to fetch ACLs' }, { status: 500 });
    }
}
/**
 * POST /api/forms/[id]/acl
 * Create ACL entry for a form
 * Requires: admin role OR MANAGE_ACL permission
 */
export async function POST(request) {
    try {
        const db = getDb();
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const formId = extractFormId(request);
        if (!formId) {
            return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
        }
        const body = await request.json();
        // Validate required fields
        if (!body.principalType || !body.principalId || !body.permissions) {
            return NextResponse.json({ error: 'Missing required fields: principalType, principalId, permissions' }, { status: 400 });
        }
        // Check form exists
        const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
        if (!form) {
            return NextResponse.json({ error: 'Form not found' }, { status: 404 });
        }
        // Check access
        const hasAccess = await canManageAcls(db, formId, user.sub, user.roles || []);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        // Check if ACL entry already exists
        const [existing] = await db
            .select()
            .from(formsAcls)
            .where(and(eq(formsAcls.formId, formId), eq(formsAcls.principalType, body.principalType), eq(formsAcls.principalId, body.principalId)))
            .limit(1);
        if (existing) {
            return NextResponse.json({ error: 'ACL entry already exists' }, { status: 400 });
        }
        const result = await db
            .insert(formsAcls)
            .values({
            formId: formId,
            principalType: body.principalType,
            principalId: body.principalId,
            permissions: Array.isArray(body.permissions) ? body.permissions : [],
            createdBy: user.sub,
        })
            .returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[forms] Create ACL error:', error);
        return NextResponse.json({ error: 'Failed to create ACL' }, { status: 500 });
    }
}
/**
 * DELETE /api/forms/[id]/acl/[aclId]
 * Delete ACL entry
 * Requires: admin role OR MANAGE_ACL permission
 */
export async function DELETE(request) {
    try {
        const db = getDb();
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const formId = extractFormId(request);
        const aclId = extractAclId(request);
        if (!formId || !aclId) {
            return NextResponse.json({ error: 'Missing form or ACL id' }, { status: 400 });
        }
        // Get ACL entry
        const [acl] = await db
            .select()
            .from(formsAcls)
            .where(eq(formsAcls.id, aclId))
            .limit(1);
        if (!acl) {
            return NextResponse.json({ error: 'ACL entry not found' }, { status: 404 });
        }
        // Verify ACL belongs to the form
        if (acl.formId !== formId) {
            return NextResponse.json({ error: 'ACL does not belong to this form' }, { status: 400 });
        }
        // Check access
        const hasAccess = await canManageAcls(db, formId, user.sub, user.roles || []);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        await db.delete(formsAcls).where(eq(formsAcls.id, aclId));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[forms] Delete ACL error:', error);
        return NextResponse.json({ error: 'Failed to delete ACL' }, { status: 500 });
    }
}
//# sourceMappingURL=acl.js.map