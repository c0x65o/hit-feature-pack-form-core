// src/server/api/forms.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formsAcls } from '@/lib/feature-pack-schemas';
import { and, asc, desc, eq, like, or, sql, inArray } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { resolveFormCoreScopeMode } from '../lib/scope-mode';
import { requireFormCoreAction } from '../lib/require-action';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/forms
 *
 * Two modes:
 * - admin=true: List ALL forms (requires admin role) - for form definition management
 * - default: List forms user has READ ACL for - for nav and entry access
 */
export async function GET(request) {
    try {
        const db = getDb();
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
        // Admin mode - list all forms for management
        const adminMode = searchParams.get('admin') === 'true';
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = user.sub;
        const roles = user.roles || [];
        // Admin mode: return all forms (for form definition management)
        if (adminMode) {
            // Check create permission for admin mode (form management)
            const createCheck = await requireFormCoreAction(request, 'form-core.forms.create');
            if (createCheck)
                return createCheck;
            // Also check read scope
            const mode = await resolveFormCoreScopeMode(request, { entity: 'forms', verb: 'read' });
            if (mode === 'none') {
                return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
            }
            const conditions = [];
            // Apply scope-based filtering (explicit branching on own/ldd/any)
            // Note: 'none' mode already handled above with early return
            if (mode === 'any') {
                // No scoping - show all forms
            }
            else if (mode === 'own' || mode === 'ldd') {
                // Forms don't have LDD fields, so ldd behaves like own (check ownerUserId)
                conditions.push(eq(forms.ownerUserId, userId));
            }
            if (search) {
                conditions.push(or(like(forms.name, `%${search}%`), like(forms.slug, `%${search}%`)));
            }
            const sortColumns = {
                name: forms.name,
                slug: forms.slug,
                createdAt: forms.createdAt,
                updatedAt: forms.updatedAt,
            };
            const orderCol = sortColumns[sortBy] ?? forms.createdAt;
            const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);
            const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
            const [countResult] = await db
                .select({ count: sql `count(*)` })
                .from(forms)
                .where(whereClause);
            const total = Number(countResult?.count || 0);
            const items = await db
                .select()
                .from(forms)
                .where(whereClause)
                .orderBy(orderDirection)
                .limit(pageSize)
                .offset(offset);
            return NextResponse.json({
                items,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
            });
        }
        // User mode: forms they have READ ACL for OR published forms with ACL disabled
        // Check read scope mode
        const mode = await resolveFormCoreScopeMode(request, { entity: 'forms', verb: 'read' });
        // Apply scope-based filtering (explicit branching on none/own/ldd/any)
        if (mode === 'none') {
            // Explicit deny: return empty results
            return NextResponse.json({
                items: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 },
            });
        }
        const principalIds = [userId, ...roles].filter((id) => Boolean(id));
        // Get form IDs user has READ access to via ACL
        const aclFormIds = [];
        if (principalIds.length > 0) {
            const aclEntries = await db
                .select({ formId: formsAcls.formId, permissions: formsAcls.permissions })
                .from(formsAcls)
                .where(or(...principalIds.map((id) => eq(formsAcls.principalId, id))));
            // Filter to only forms with READ permission
            for (const entry of aclEntries) {
                const perms = entry.permissions || [];
                if (perms.includes('READ')) {
                    aclFormIds.push(entry.formId);
                }
            }
        }
        // Build conditions - forms with ACL access OR published forms with ACL disabled
        const accessConditions = [];
        if (mode === 'any') {
            // No scoping - show all forms (subject to ACL)
            if (aclFormIds.length > 0) {
                accessConditions.push(inArray(forms.id, Array.from(new Set(aclFormIds))));
            }
            accessConditions.push(and(eq(forms.isPublished, true), eq(forms.aclEnabled, false)));
        }
        else if (mode === 'own' || mode === 'ldd') {
            // Forms don't have LDD fields, so ldd behaves like own (check ownerUserId)
            // Only show forms owned by user (subject to ACL)
            if (aclFormIds.length > 0) {
                accessConditions.push(and(inArray(forms.id, Array.from(new Set(aclFormIds))), eq(forms.ownerUserId, userId)));
            }
            // Also include published forms with ACL disabled that are owned by user
            accessConditions.push(and(eq(forms.isPublished, true), eq(forms.aclEnabled, false), eq(forms.ownerUserId, userId)));
        }
        const conditions = [
            accessConditions.length > 1 ? or(...accessConditions) : accessConditions[0]
        ];
        if (search) {
            conditions.push(or(like(forms.name, `%${search}%`), like(forms.slug, `%${search}%`)));
        }
        // Sorting
        const sortColumns = {
            name: forms.name,
            slug: forms.slug,
            createdAt: forms.createdAt,
            updatedAt: forms.updatedAt,
        };
        const orderCol = sortColumns[sortBy] ?? forms.createdAt;
        const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);
        const whereClause = and(...conditions);
        // Get count
        const [countResult] = await db
            .select({ count: sql `count(*)` })
            .from(forms)
            .where(whereClause);
        const total = Number(countResult?.count || 0);
        // Get items
        const items = await db
            .select()
            .from(forms)
            .where(whereClause)
            .orderBy(orderDirection)
            .limit(pageSize)
            .offset(offset);
        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    }
    catch (error) {
        console.error('[forms] List error:', error);
        return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
    }
}
/**
 * POST /api/forms
 * Create a new form - requires admin role
 */
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        if (!body.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        const user = extractUserFromRequest(request);
        if (!user?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check create permission
        const createCheck = await requireFormCoreAction(request, 'form-core.forms.create');
        if (createCheck)
            return createCheck;
        // Check write scope mode
        const mode = await resolveFormCoreScopeMode(request, { entity: 'forms', verb: 'write' });
        if (mode === 'none') {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        const formId = crypto.randomUUID();
        const versionId = crypto.randomUUID();
        const slug = body.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        // Create form
        await db.insert(forms).values({
            id: formId,
            name: body.name,
            slug: slug,
            description: body.description || null,
            ownerUserId: user.sub,
            // Navigation config
            navShow: body.navShow ?? true,
            navPlacement: body.navPlacement || 'under_forms',
            navGroup: body.navGroup || 'main',
            navWeight: typeof body.navWeight === 'number' ? body.navWeight : 500,
            navLabel: body.navLabel || null,
            navIcon: body.navIcon || null,
            navParentPath: body.navParentPath || null,
        });
        // Create initial draft version
        await db.insert(formVersions).values({
            id: versionId,
            formId: formId,
            version: 1,
            status: 'draft',
            createdByUserId: user.sub,
        });
        const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
        return NextResponse.json(form, { status: 201 });
    }
    catch (error) {
        console.error('[forms] Create error:', error);
        return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
    }
}
//# sourceMappingURL=forms.js.map