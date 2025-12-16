// src/server/api/entries.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields, formEntries } from '@/lib/feature-pack-schemas';
import { and, asc, desc, eq, like, sql, type AnyColumn } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractFormId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/forms/{id}/entries -> find 'entries' and go back one
  const entriesIndex = parts.indexOf('entries');
  return entriesIndex > 0 ? parts[entriesIndex - 1] : null;
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
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const formId = extractFormId(request);
    if (!formId) {
      return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
    }

    const userId = getUserId(request);
    if (!userId) {
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

    // Get form
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check access to form
    const canAccessForm =
      form.ownerUserId === userId || (form.isPublished && form.scope === 'project');
    if (!canAccessForm) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Build entry conditions based on scope
    const conditions = [eq(formEntries.formId, formId)];

    // For private scope, user only sees their own entries
    if (form.scope === 'private') {
      conditions.push(eq(formEntries.createdByUserId, userId));
    }

    // Search
    if (search) {
      conditions.push(like(formEntries.searchText, `%${search}%`));
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

    // Get published version fields for reference
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
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const formId = extractFormId(request);
    if (!formId) {
      return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Get form
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check access - must be published for project scope, or owner for private
    const canCreate =
      form.ownerUserId === userId || (form.isPublished && form.scope === 'project');
    if (!canCreate) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const entryId = crypto.randomUUID();
    const data = body.data || body || {};
    const searchText = computeSearchText(data);

    await db.insert(formEntries).values({
      id: entryId,
      formId: formId,
      createdByUserId: userId,
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
