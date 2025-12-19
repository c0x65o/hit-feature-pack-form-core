// src/server/api/entries-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formEntries, formEntryHistory, formsAcls } from '@/lib/feature-pack-schemas';
import { and, eq, or, sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { FORM_PERMISSIONS } from '../../schema/forms';

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

function extractIds(request: NextRequest): { formId: string | null; entryId: string | null } {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/forms/{formId}/entries/{entryId}
  const entriesIndex = parts.indexOf('entries');
  return {
    formId: entriesIndex > 0 ? parts[entriesIndex - 1] : null,
    entryId: entriesIndex >= 0 && parts.length > entriesIndex + 1 ? parts[entriesIndex + 1] : null,
  };
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
      const obj = v as Record<string, unknown>;
      if (obj.label && typeof obj.label === 'string') parts.push(obj.label);
    }
  }
  return parts.join(' ');
}

/**
 * GET /api/forms/[id]/entries/[entryId]
 * Get a single entry
 * Requires: READ ACL
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { formId, entryId } = extractIds(request);
    if (!formId || !entryId) {
      return NextResponse.json({ error: 'Missing form or entry id' }, { status: 400 });
    }

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ACL - need READ permission
    const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.READ);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get entry
    const [entry] = await db
      .select()
      .from(formEntries)
      .where(and(eq(formEntries.id, entryId), eq(formEntries.formId, formId)))
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('[forms] Get entry error:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

/**
 * PUT /api/forms/[id]/entries/[entryId]
 * Update an entry (with history tracking)
 * Requires: WRITE ACL
 */
export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const { formId, entryId } = extractIds(request);
    if (!formId || !entryId) {
      return NextResponse.json({ error: 'Missing form or entry id' }, { status: 400 });
    }

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check ACL - need WRITE permission
    const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.WRITE);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get existing entry
    const [existingEntry] = await db
      .select()
      .from(formEntries)
      .where(and(eq(formEntries.id, entryId), eq(formEntries.formId, formId)))
      .limit(1);

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Save history snapshot before update
    const [historyCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(formEntryHistory)
      .where(eq(formEntryHistory.entryId, entryId));
    const historyVersion = Number(historyCount?.count || 0) + 1;

    await db.insert(formEntryHistory).values({
      id: crypto.randomUUID(),
      entryId: entryId,
      formId: formId,
      version: historyVersion,
      changedByUserId: user.sub,
      changeType: 'update',
      snapshot: existingEntry.data,
    });

    // Update entry
    const newData = body.data || body || {};
    const searchText = computeSearchText(newData);

    await db
      .update(formEntries)
      .set({
        data: newData,
        searchText: searchText,
        updatedByUserId: user.sub,
        updatedAt: new Date(),
      })
      .where(eq(formEntries.id, entryId));

    const [updatedEntry] = await db
      .select()
      .from(formEntries)
      .where(eq(formEntries.id, entryId))
      .limit(1);

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('[forms] Update entry error:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id]/entries/[entryId]
 * Delete an entry (with history tracking)
 * Requires: DELETE ACL
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const { formId, entryId } = extractIds(request);
    if (!formId || !entryId) {
      return NextResponse.json({ error: 'Missing form or entry id' }, { status: 400 });
    }

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ACL - need DELETE permission
    const hasAccess = await hasFormPermission(db, formId, user.sub, user.roles || [], FORM_PERMISSIONS.DELETE);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Get existing entry
    const [existingEntry] = await db
      .select()
      .from(formEntries)
      .where(and(eq(formEntries.id, entryId), eq(formEntries.formId, formId)))
      .limit(1);

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Save history snapshot before delete
    const [historyCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(formEntryHistory)
      .where(eq(formEntryHistory.entryId, entryId));
    const historyVersion = Number(historyCount?.count || 0) + 1;

    await db.insert(formEntryHistory).values({
      id: crypto.randomUUID(),
      entryId: entryId,
      formId: formId,
      version: historyVersion,
      changedByUserId: user.sub,
      changeType: 'delete',
      snapshot: existingEntry.data,
    });

    // Delete entry
    await db.delete(formEntries).where(eq(formEntries.id, entryId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[forms] Delete entry error:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
