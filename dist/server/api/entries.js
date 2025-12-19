// src/server/api/entries.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields, formEntries, formsAcls } from '@/lib/feature-pack-schemas';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { FORM_PERMISSIONS } from '../../schema/forms';
/**
 * Check if user can access a form
 * Draft (isPublished=false): only owner and admins can see
 * Public (isPublished=true): owner, admins, and users with ACL entries can see
 */
async function checkFormAccess(db, formId, userId, roles = [], requiredPermission) {
    // Check if user is owner
    const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
    if (!form)
        return false;
    if (form.ownerUserId === userId)
        return true;
    // Check if user is admin
    if (roles.includes('admin') || roles.includes('Admin'))
        return true;
    // Draft forms: only owner and admin can access
    if (!form.isPublished)
        return false;
    // Public forms: check ACL entries
    const principalIds = [userId, ...roles].filter(Boolean);
    if (principalIds.length === 0)
        return false;
    const aclEntries = await db
        .select()
        .from(formsAcls)
        .where(and(eq(formsAcls.formId, formId), or(...principalIds.map((id) => eq(formsAcls.principalId, id)))));
    if (aclEntries.length === 0)
        return false;
    // If specific permission required, check it
    if (requiredPermission) {
        const allPermissions = aclEntries.flatMap((e) => e.permissions || []);
        return allPermissions.includes(requiredPermission);
    }
    return true; // Has some ACL entry
}
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractFormId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/forms/{id}/entries -> find 'entries' and go back one
    const entriesIndex = parts.indexOf('entries');
    return entriesIndex > 0 ? parts[entriesIndex - 1] : null;
}
/**
 * Compute denormalized search text from entry data
 */
function computeSearchText(data) {
    const parts = [];
    for (const v of Object.values(data || {})) {
        if (v === null || v === undefined)
            continue;
        if (typeof v === 'string')
            parts.push(v);
        else if (typeof v === 'number' || typeof v === 'boolean')
            parts.push(String(v));
        else if (typeof v === 'object' && !Array.isArray(v)) {
            // Support reference-field objects: { formId, entryId, label? }
            const obj = v;
            if (obj.label && typeof obj.label === 'string')
                parts.push(obj.label);
        }
    }
    return parts.join(' ');
}
/**
 * GET /api/forms/[id]/entries
 * List entries for a form with pagination, sorting, and search
 */
export async function GET(request) {
    try {
        const db = getDb();
        const formId = extractFormId(request);
        if (!formId) {
            return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
        }
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
        const offset = (page - 1) * pageSize;
        // Sorting
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        // Search
        const search = searchParams.get('search') || '';
        // Check access (owner, admin, or ACL with READ permission)
        const hasAccess = await checkFormAccess(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.READ);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        // Get form
        const [form] = await db
            .select()
            .from(forms)
            .where(eq(forms.id, formId))
            .limit(1);
        if (!form) {
            return NextResponse.json({ error: 'Form not found' }, { status: 404 });
        }
        // Build entry conditions
        const conditions = [eq(formEntries.formId, formId)];
        // Search
        if (search) {
            conditions.push(like(formEntries.searchText, `%${search}%`));
        }
        // Sorting
        const sortColumns = {
            createdAt: formEntries.createdAt,
            updatedAt: formEntries.updatedAt,
        };
        const orderCol = sortColumns[sortBy] ?? formEntries.createdAt;
        const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);
        const whereClause = and(...conditions);
        // Get count
        const [countResult] = await db
            .select({ count: sql `count(*)` })
            .from(formEntries)
            .where(whereClause);
        const total = Number(countResult?.count || 0);
        // Get entries
        const entries = await db
            .select()
            .from(formEntries)
            .where(whereClause)
            .orderBy(orderDirection)
            .limit(pageSize)
            .offset(offset);
        // Get published version fields for reference
        const [publishedVersion] = await db
            .select()
            .from(formVersions)
            .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'published')))
            .orderBy(desc(formVersions.version))
            .limit(1);
        let fields = [];
        if (publishedVersion) {
            fields = await db
                .select()
                .from(formFields)
                .where(eq(formFields.versionId, publishedVersion.id))
                .orderBy(formFields.order);
        }
        return NextResponse.json({
            items: entries,
            fields,
            listConfig: publishedVersion?.listConfig || null,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        console.error('[forms] List entries error:', error);
        return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }
}
/**
 * POST /api/forms/[id]/entries
 * Create a new entry
 */
export async function POST(request) {
    try {
        const db = getDb();
        const formId = extractFormId(request);
        if (!formId) {
            return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
        }
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        // Check access (owner, admin, or ACL with WRITE permission)
        const hasAccess = await checkFormAccess(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.WRITE);
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        const entryId = crypto.randomUUID();
        const data = body.data || body || {};
        const searchText = computeSearchText(data);
        await db.insert(formEntries).values({
            id: entryId,
            formId: formId,
            createdByUserId: user.sub,
            data: data,
            searchText: searchText,
        });
        const [entry] = await db
            .select()
            .from(formEntries)
            .where(eq(formEntries.id, entryId))
            .limit(1);
        return NextResponse.json(entry, { status: 201 });
    }
    catch (error) {
        console.error('[forms] Create entry error:', error);
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }
}
//# sourceMappingURL=entries.js.map