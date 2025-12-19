// src/server/api/forms-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields, formEntries, formEntryHistory, formsAcls } from '@/lib/feature-pack-schemas';
import { and, desc, eq, or } from 'drizzle-orm';
import { extractUserFromRequest, getUserId } from '../auth';
import { FORM_PERMISSIONS } from '../../schema/forms';

/**
 * Check if user can access a form
 * Draft (isPublished=false): only owner and admins can see
 * Public (isPublished=true): owner, admins, and users with ACL entries can see
 */
async function canAccessForm(
  db: ReturnType<typeof getDb>,
  formId: string,
  userId: string,
  roles: string[] = []
): Promise<boolean> {
  // Check if user is owner
  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form) return false;
  if (form.ownerUserId === userId) return true;

  // Check if user is admin
  if (roles.includes('admin') || roles.includes('Admin')) return true;

  // Draft forms: only owner and admin can access
  if (!form.isPublished) return false;

  // Public forms: check ACL entries (user email, groups, roles)
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
    )
    .limit(1);

  return aclEntries.length > 0;
}

/**
 * Check if user can edit a form (owner, admin, or has ACL entry with MANAGE_ACL permission)
 */
async function canEditForm(
  db: ReturnType<typeof getDb>,
  formId: string,
  userId: string,
  roles: string[] = []
): Promise<boolean> {
  // Check if user is owner
  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form) return false;
  if (form.ownerUserId === userId) return true;

  // Check if user is admin
  if (roles.includes('admin') || roles.includes('Admin')) return true;

  // Check ACL entries for MANAGE_ACL permission
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

  // Check if user has MANAGE_ACL permission
  const allPermissions = aclEntries.flatMap((e: { permissions: string[] | null }) => e.permissions || []);
  return allPermissions.includes(FORM_PERMISSIONS.MANAGE_ACL);
}

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

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check access (owner, admin, or ACL)
    const hasAccess = await canAccessForm(db, formId, user.sub, user.roles || []);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
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
      form,
      version: version ? { ...version, fields } : null,
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

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
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

    // Check access (owner, admin, or ACL with MANAGE_ACL permission)
    const canEdit = await canEditForm(db, formId, user.sub, user.roles || []);
    if (!canEdit) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Update form metadata
    const formUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) formUpdate.name = body.name;
    if (body.description !== undefined) formUpdate.description = body.description;
    if (body.navShow !== undefined) formUpdate.navShow = body.navShow;
    if (body.navPlacement !== undefined) formUpdate.navPlacement = body.navPlacement;
    if (body.navGroup !== undefined) formUpdate.navGroup = body.navGroup;
    if (body.navWeight !== undefined) formUpdate.navWeight = body.navWeight;
    if (body.navLabel !== undefined) formUpdate.navLabel = body.navLabel;
    if (body.navIcon !== undefined) formUpdate.navIcon = body.navIcon;
    if (body.navParentPath !== undefined) formUpdate.navParentPath = body.navParentPath;

    await db.update(forms).set(formUpdate).where(eq(forms.id, formId));

    // Update fields if provided (check both body.fields and body.draft.fields for compatibility)
    const fieldsToUpdate = body.draft?.fields || body.fields;
    if (fieldsToUpdate && Array.isArray(fieldsToUpdate)) {
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
        for (let i = 0; i < fieldsToUpdate.length; i++) {
          const field = fieldsToUpdate[i];
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

        // Update list config if provided (check both body.draft.listConfig and body.listConfig for compatibility)
        const listConfigToUpdate = body.draft?.listConfig !== undefined ? body.draft.listConfig : body.listConfig;
        if (listConfigToUpdate !== undefined) {
          await db
            .update(formVersions)
            .set({ listConfig: listConfigToUpdate })
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
      form: updatedForm,
      version: latestVersion ? { ...latestVersion, fields } : null,
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

    const user = extractUserFromRequest(request);
    if (!user?.sub) {
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

    // Check access (owner, admin, or ACL with MANAGE_ACL permission)
    const canEdit = await canEditForm(db, formId, user.sub, user.roles || []);
    if (!canEdit) {
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
