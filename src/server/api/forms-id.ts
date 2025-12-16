// src/server/api/forms-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields, formEntries, formEntryHistory } from '@/lib/feature-pack-schemas';
import { and, desc, eq } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractFormId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/forms/{id} -> id is last segment
  return parts[parts.length - 1] || null;
}

/**
 * GET /api/forms/[id]
 * Get a form with its current draft version and fields
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

    // Get form
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check access
    if (form.ownerUserId !== userId && !(form.isPublished && form.scope === 'project')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get latest draft version
    const [version] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'draft')))
      .orderBy(desc(formVersions.version))
      .limit(1);

    // Get fields for this version
    let fields: any[] = [];
    if (version) {
      fields = await db
        .select()
        .from(formFields)
        .where(eq(formFields.versionId, version.id))
        .orderBy(formFields.order);
    }

    return NextResponse.json({
      ...form,
      currentVersion: version || null,
      fields,
    });
  } catch (error) {
    console.error('[forms] Get form error:', error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

/**
 * PUT /api/forms/[id]
 * Update form metadata and fields
 */
export async function PUT(request: NextRequest) {
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

    // Get existing form
    const [existingForm] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check ownership
    if (existingForm.ownerUserId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update form metadata
    const formUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) formUpdate.name = body.name;
    if (body.description !== undefined) formUpdate.description = body.description;
    if (body.scope !== undefined) formUpdate.scope = body.scope;
    if (body.navShow !== undefined) formUpdate.navShow = body.navShow;
    if (body.navPlacement !== undefined) formUpdate.navPlacement = body.navPlacement;
    if (body.navGroup !== undefined) formUpdate.navGroup = body.navGroup;
    if (body.navWeight !== undefined) formUpdate.navWeight = body.navWeight;
    if (body.navLabel !== undefined) formUpdate.navLabel = body.navLabel;
    if (body.navIcon !== undefined) formUpdate.navIcon = body.navIcon;

    await db.update(forms).set(formUpdate).where(eq(forms.id, formId));

    // Update fields if provided
    if (body.fields && Array.isArray(body.fields)) {
      // Get current draft version
      const [version] = await db
        .select()
        .from(formVersions)
        .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'draft')))
        .orderBy(desc(formVersions.version))
        .limit(1);

      if (version) {
        // Delete existing fields
        await db.delete(formFields).where(eq(formFields.versionId, version.id));

        // Insert new fields
        for (let i = 0; i < body.fields.length; i++) {
          const field = body.fields[i];
          await db.insert(formFields).values({
            id: field.id || crypto.randomUUID(),
            formId: formId,
            versionId: version.id,
            key: field.key,
            label: field.label,
            type: field.type,
            order: i,
            hidden: field.hidden || false,
            required: field.required || false,
            config: field.config || null,
            defaultValue: field.defaultValue || null,
          });
        }

        // Update list config if provided
        if (body.listConfig !== undefined) {
          await db
            .update(formVersions)
            .set({ listConfig: body.listConfig })
            .where(eq(formVersions.id, version.id));
        }
      }
    }

    // Fetch updated form with version and fields
    const [updatedForm] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);

    const [latestVersion] = await db
      .select()
      .from(formVersions)
      .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'draft')))
      .orderBy(desc(formVersions.version))
      .limit(1);

    let fields: any[] = [];
    if (latestVersion) {
      fields = await db
        .select()
        .from(formFields)
        .where(eq(formFields.versionId, latestVersion.id))
        .orderBy(formFields.order);
    }

    return NextResponse.json({
      ...updatedForm,
      currentVersion: latestVersion || null,
      fields,
    });
  } catch (error) {
    console.error('[forms] Update form error:', error);
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id]
 * Delete form and all related data (versions, fields, entries, history)
 */
export async function DELETE(request: NextRequest) {
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

    // Get existing form
    const [existingForm] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!existingForm) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Check ownership
    if (existingForm.ownerUserId !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Delete in order: history -> entries -> fields -> versions -> form
    // 1. Delete entry history
    await db.delete(formEntryHistory).where(eq(formEntryHistory.formId, formId));

    // 2. Delete entries
    await db.delete(formEntries).where(eq(formEntries.formId, formId));

    // 3. Delete fields
    await db.delete(formFields).where(eq(formFields.formId, formId));

    // 4. Delete versions
    await db.delete(formVersions).where(eq(formVersions.formId, formId));

    // 5. Delete form
    await db.delete(forms).where(eq(forms.id, formId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[forms] Delete form error:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}
