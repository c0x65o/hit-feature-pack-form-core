// src/server/api/unpublish.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { forms, formVersions } from '@/lib/feature-pack-schemas';
import { and, eq } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractFormId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/forms/{id}/unpublish -> id is third from last
    const unpublishIndex = parts.indexOf('unpublish');
    return unpublishIndex > 0 ? parts[unpublishIndex - 1] : null;
}
/**
 * POST /api/forms/[id]/unpublish
 * Unpublish a form - marks form as not published
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
        if (!form.isPublished) {
            return NextResponse.json({ error: 'Form is not published' }, { status: 400 });
        }
        // Mark published version as archived
        await db
            .update(formVersions)
            .set({ status: 'archived' })
            .where(and(eq(formVersions.formId, formId), eq(formVersions.status, 'published')));
        // Mark form as unpublished
        await db
            .update(forms)
            .set({ isPublished: false, updatedAt: new Date() })
            .where(eq(forms.id, formId));
        // Return updated form
        const [updatedForm] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
        return NextResponse.json({
            ...updatedForm,
            message: 'Form unpublished successfully',
        });
    }
    catch (error) {
        console.error('[forms] Unpublish error:', error);
        return NextResponse.json({ error: 'Failed to unpublish form' }, { status: 500 });
    }
}
//# sourceMappingURL=unpublish.js.map