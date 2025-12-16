// src/server/api/publish.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions, formFields } from '@/lib/feature-pack-schemas';
import { and, desc, eq } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractFormId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/forms/{id}/publish -> id is third from last
    const publishIndex = parts.indexOf('publish');
    return publishIndex > 0 ? parts[publishIndex - 1] : null;
}
/**
 * POST /api/forms/[id]/publish
 * Publish a form - creates published version from current draft
 */
export async function POST(request) {
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
        // Check ownership
        if (form.ownerUserId !== userId) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
        }
        // Get current draft version
        const [draftVersion] = await db
            .select()
            .from(formVersions)
            .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'draft')))
            .orderBy(desc(formVersions.version))
            .limit(1);
        if (!draftVersion) {
            return NextResponse.json({ error: 'No draft version to publish' }, { status: 400 });
        }
        // Get draft fields
        const draftFields = await db
            .select()
            .from(formFields)
            .where(eq(formFields.versionId, draftVersion.id))
            .orderBy(formFields.order);
        if (draftFields.length === 0) {
            return NextResponse.json({ error: 'Cannot publish form with no fields' }, { status: 400 });
        }
        // Mark any existing published version as archived (just update status)
        await db
            .update(formVersions)
            .set({ status: 'archived' })
            .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'published')));
        // Create new published version
        const publishedVersionId = crypto.randomUUID();
        const newVersionNumber = draftVersion.version + 1;
        await db.insert(formVersions).values({
            id: publishedVersionId,
            formId: formId,
            version: newVersionNumber,
            status: 'published',
            listConfig: draftVersion.listConfig,
            createdByUserId: userId,
        });
        // Copy fields to published version
        for (const field of draftFields) {
            await db.insert(formFields).values({
                id: crypto.randomUUID(),
                formId: formId,
                versionId: publishedVersionId,
                key: field.key,
                label: field.label,
                type: field.type,
                order: field.order,
                hidden: field.hidden,
                required: field.required,
                config: field.config,
                defaultValue: field.defaultValue,
            });
        }
        // Mark form as published
        await db
            .update(forms)
            .set({ isPublished: true, updatedAt: new Date() })
            .where(eq(forms.id, formId));
        // Return updated form
        const [updatedForm] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
        return NextResponse.json({
            ...updatedForm,
            publishedVersionId,
            message: 'Form published successfully',
        });
    }
    catch (error) {
        console.error('[forms] Publish error:', error);
        return NextResponse.json({ error: 'Failed to publish form' }, { status: 500 });
    }
}
//# sourceMappingURL=publish.js.map