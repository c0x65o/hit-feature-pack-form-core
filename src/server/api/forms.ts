// src/server/api/forms.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formsAcls } from '@/lib/feature-pack-schemas';
import { and, asc, desc, eq, like, or, sql, type AnyColumn, inArray } from 'drizzle-orm';
import { extractUserFromRequest, getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/forms
 * List forms with pagination, sorting, and search
 */
export async function GET(request: NextRequest) {
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

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.sub;
    const roles = user.roles || [];

    // Get forms where user has ACL access (for published forms)
    const principalIds: string[] = [userId, ...roles].filter((id): id is string => Boolean(id));
    const aclFormIds: string[] = [];
    if (principalIds.length > 0) {
      const aclEntries = await db
        .select({ formId: formsAcls.formId })
        .from(formsAcls)
        .where(
          or(...principalIds.map((id: string) => eq(formsAcls.principalId, id)))!
        );
      const formIds = aclEntries.map((e: { formId: string }) => e.formId);
      aclFormIds.push(...Array.from(new Set<string>(formIds)));
    }

    // Build conditions - user can see their own forms + published forms with ACL access
    const conditions = [
      or(
        eq(forms.ownerUserId, userId),
        and(
          eq(forms.isPublished, true),
          aclFormIds.length > 0 ? inArray(forms.id, aclFormIds) : sql`false`
        )
      )!
    ];

    if (search) {
      conditions.push(
        or(
          like(forms.name, `%${search}%`),
          like(forms.slug, `%${search}%`)
        )!
      );
    }

    // Sorting
    const sortColumns: Record<string, AnyColumn> = {
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
      .select({ count: sql<number>`count(*)` })
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
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[forms] List error:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

/**
 * POST /api/forms
 * Create a new form with initial draft version
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      ownerUserId: userId,
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
      createdByUserId: userId,
    });

    const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error('[forms] Create error:', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
}
