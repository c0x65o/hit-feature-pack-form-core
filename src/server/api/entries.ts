// src/server/api/entries.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields, formEntries, formsAcls } from '@/lib/feature-pack-schemas';
import { and, asc, desc, eq, like, or, sql, type AnyColumn } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { FORM_PERMISSIONS } from '../../schema/forms';
import { resolveFormCoreScopeMode } from '../lib/scope-mode';
import { requireFormCoreAction } from '../lib/require-action';

/**
 * Check if user has a specific ACL permission on a form
 */
async function hasFormPermission(
  db: ReturnType<typeof getDb>,
  formId: string,
  userId: string,
  roles: string[],
  permission: string
): Promise<boolean> {
  const principalIds = [userId, ...roles].filter(Boolean);
  if (principalIds.length === 0) return false;

  const aclEntries = await db
    .select()
    .from(formsAcls)
    .where(
      and(
        eq(formsAcls.formId, formId),
        or(...principalIds.map((id) => eq(formsAcls.principalId, id)))
      )
    );

  if (aclEntries.length === 0) return false;

  const allPermissions = aclEntries.flatMap((e: { permissions: string[] | null }) => e.permissions || []);
  return allPermissions.includes(permission);
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractFormId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/forms/{id}/entries -> find 'entries' and go back one
  const entriesIndex = parts.indexOf('entries');
  return entriesIndex > 0 ? parts[entriesIndex - 1] : null;
}

function isSafeKey(v: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(v);
}

/**
 * Compute denormalized search text from entry data
 */
function computeSearchText(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const v of Object.values(data || {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') parts.push(v);
    else if (typeof v === 'number' || typeof v === 'boolean') parts.push(String(v));
    else if (typeof v === 'object' && !Array.isArray(v)) {
      // Support reference-field objects: { formId, entryId, label? }
      const obj = v as Record<string, unknown>;
      if (obj.label && typeof obj.label === 'string') parts.push(obj.label);
    }
  }
  return parts.join(' ');
}

/**
 * GET /api/forms/[id]/entries
 * List entries for a form with pagination, sorting, and search
 * Requires: READ ACL
 */
export async function GET(request: NextRequest) {
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

    // Optional: filter entries by a linked entity reference field.
    // Used to power "dynamic entity tabs" (projects/companies/etc) without entity-specific endpoints.
    const linkedEntityKind = (searchParams.get('linkedEntityKind') || '').trim();
    const linkedEntityId = (searchParams.get('linkedEntityId') || '').trim();
    const linkedFieldKey = (searchParams.get('linkedFieldKey') || '').trim();
    const wantsLinkedFilter = Boolean(linkedEntityKind || linkedEntityId || linkedFieldKey);
    if (wantsLinkedFilter) {
      if (!linkedEntityKind || !linkedEntityId || !linkedFieldKey) {
        return NextResponse.json(
          { error: 'linkedEntityKind, linkedEntityId, and linkedFieldKey are required together' },
          { status: 400 }
        );
      }
      if (!isSafeKey(linkedEntityKind) || !isSafeKey(linkedEntityId) || !isSafeKey(linkedFieldKey)) {
        return NextResponse.json({ error: 'Invalid linked entity filter' }, { status: 400 });
      }
    }

    // Check read scope mode for entries
    const mode = await resolveFormCoreScopeMode(request, { entity: 'entries', verb: 'read' });
    
    if (mode === 'none') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Get form to check ownership and ACL
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    
    // Apply scope-based access control (explicit branching on none/own/ldd/any)
    // Entries are scoped by form ownership, then ACLs apply
    if (mode === 'any') {
      // No scoping - check ACL if enabled
      if (form.aclEnabled) {
        const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.READ);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      } else if (!form.isPublished) {
        // Unpublished forms without ACL require ownership
        if (form.ownerUserId !== user.sub) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      }
    } else if (mode === 'own' || mode === 'ldd') {
      // Forms don't have LDD fields, so ldd behaves like own (check form ownerUserId)
      if (form.ownerUserId !== user.sub) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      // Also check ACL if enabled
      if (form.aclEnabled) {
        const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.READ);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      }
    }


    // Get published version fields for reference (also used for linkedEntity filter validation)
    const [publishedVersion] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'published')))
      .orderBy(desc(formVersions.version))
      .limit(1);

    let fields: any[] = [];
    if (publishedVersion) {
      fields = await db
        .select()
        .from(formFields)
        .where(eq(formFields.versionId, publishedVersion.id))
        .orderBy(formFields.order);
    }

    // Build entry conditions
    const conditions = [eq(formEntries.formId, formId)];

    // Search
    if (search) {
      conditions.push(like(formEntries.searchText, `%${search}%`));
    }

    // Linked entity filter
    if (wantsLinkedFilter) {
      const linkedField = fields.find((f: any) => {
        if (f?.key !== linkedFieldKey) return false;
        if (f?.type !== 'entity_reference') return false;
        const cfg = f.config && typeof f.config === 'object' ? (f.config as any) : null;
        const kind = String(cfg?.entity?.kind || '');
        return kind === linkedEntityKind;
      });
      if (!linkedField) {
        return NextResponse.json(
          { error: 'linkedFieldKey is not a valid entity_reference field for linkedEntityKind on this form' },
          { status: 400 }
        );
      }

      conditions.push(
        sql`(
          ${formEntries.data}->${sql.raw(`'${linkedFieldKey}'`)} @> ${sql.raw(`'{"entityKind":"${linkedEntityKind}","entityId":"${linkedEntityId}"}'`)}::jsonb
          OR ${formEntries.data}->${sql.raw(`'${linkedFieldKey}'`)} @> ${sql.raw(`'[{"entityKind":"${linkedEntityKind}","entityId":"${linkedEntityId}"}]'`)}::jsonb
        )`
      );
    }

    // Sorting
    const sortColumns: Record<string, AnyColumn> = {
      createdAt: formEntries.createdAt,
      updatedAt: formEntries.updatedAt,
    };
    const orderCol = sortColumns[sortBy] ?? formEntries.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

    const whereClause = and(...conditions);

    // Get count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
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
  } catch (error) {
    console.error('[forms] List entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

/**
 * POST /api/forms/[id]/entries
 * Create a new entry
 * Requires: WRITE ACL
 */
export async function POST(request: NextRequest) {
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

    // Check create permission
    const createCheck = await requireFormCoreAction(request, 'form-core.entries.create');
    if (createCheck) return createCheck;
    
    // Check write scope mode for entries
    const mode = await resolveFormCoreScopeMode(request, { entity: 'entries', verb: 'write' });
    
    if (mode === 'none') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    
    // Get form to check ownership and ACL
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }
    
    // Apply scope-based access control (explicit branching on none/own/ldd/any)
    // Entries are scoped by form ownership, then ACLs apply
    if (mode === 'any') {
      // No scoping - check ACL if enabled
      if (form.aclEnabled) {
        const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.WRITE);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      } else if (!form.isPublished) {
        // Unpublished forms without ACL require ownership
        if (form.ownerUserId !== user.sub) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      }
    } else if (mode === 'own' || mode === 'ldd') {
      // Forms don't have LDD fields, so ldd behaves like own (check form ownerUserId)
      if (form.ownerUserId !== user.sub) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
      // Also check ACL if enabled
      if (form.aclEnabled) {
        const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.WRITE);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
      }
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
  } catch (error) {
    console.error('[forms] Create entry error:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
