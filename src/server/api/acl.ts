// src/server/api/acl.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { formsAcls, forms } from '@/lib/feature-pack-schemas';
import { eq, desc, and } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('hit_token') : null;
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/**
 * GET /api/forms/[id]/acl
 * List ACLs for a form
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/forms/{formId}/acl -> formId is third-to-last part
    const formId = parts[parts.length - 2] || null;

    if (!formId) {
      return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
    }

    // Get form and check access
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Only owner can view ACLs, or users with MANAGE_ACL permission
    if (form.ownerUserId !== userId) {
      // Check if user has MANAGE_ACL via ACL entry
      const userAcls = await db
        .select()
        .from(formsAcls)
        .where(
          and(
            eq(formsAcls.formId, formId),
            eq(formsAcls.principalType, 'user'),
            eq(formsAcls.principalId, userId)
          )
        );

      const hasManageAcl = userAcls.some(
        (acl: { permissions: string[] }) => acl.permissions.includes('MANAGE_ACL')
      );

      if (!hasManageAcl) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    const items = await db
      .select()
      .from(formsAcls)
      .where(eq(formsAcls.formId, formId))
      .orderBy(desc(formsAcls.createdAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[forms] List ACL error:', error);
    return NextResponse.json({ error: 'Failed to fetch ACLs' }, { status: 500 });
  }
}

/**
 * POST /api/forms/[id]/acl
 * Create ACL entry for a form
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const formId = parts[parts.length - 2] || null;

    if (!formId) {
      return NextResponse.json({ error: 'Missing form id' }, { status: 400 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.principalType || !body.principalId || !body.permissions) {
      return NextResponse.json(
        { error: 'Missing required fields: principalType, principalId, permissions' },
        { status: 400 }
      );
    }

    // Get form and check access
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Only owner can manage ACLs, or users with MANAGE_ACL permission
    if (form.ownerUserId !== userId) {
      const userAcls = await db
        .select()
        .from(formsAcls)
        .where(
          and(
            eq(formsAcls.formId, formId),
            eq(formsAcls.principalType, 'user'),
            eq(formsAcls.principalId, userId)
          )
        );

      const hasManageAcl = userAcls.some(
        (acl: { permissions: string[] }) => acl.permissions.includes('MANAGE_ACL')
      );

      if (!hasManageAcl) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    // Check if ACL entry already exists
    const [existing] = await db
      .select()
      .from(formsAcls)
      .where(
        and(
          eq(formsAcls.formId, formId),
          eq(formsAcls.principalType, body.principalType),
          eq(formsAcls.principalId, body.principalId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'ACL entry already exists' }, { status: 400 });
    }

    const result = await db
      .insert(formsAcls)
      .values({
        formId: formId,
        principalType: body.principalType,
        principalId: body.principalId,
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        createdBy: userId,
      })
      .returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[forms] Create ACL error:', error);
    return NextResponse.json({ error: 'Failed to create ACL' }, { status: 500 });
  }
}

/**
 * DELETE /api/forms/[id]/acl/[aclId]
 * Delete ACL entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/forms/{formId}/acl/{aclId} -> formId is fourth-to-last, aclId is last
    const formId = parts[parts.length - 3] || null;
    const aclId = parts[parts.length - 1] || null;

    if (!formId || !aclId) {
      return NextResponse.json({ error: 'Missing form or ACL id' }, { status: 400 });
    }

    // Get ACL entry
    const [acl] = await db
      .select()
      .from(formsAcls)
      .where(eq(formsAcls.id, aclId))
      .limit(1);

    if (!acl) {
      return NextResponse.json({ error: 'ACL entry not found' }, { status: 404 });
    }

    // Verify ACL belongs to the form
    if (acl.formId !== formId) {
      return NextResponse.json({ error: 'ACL does not belong to this form' }, { status: 400 });
    }

    // Get form and check access
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Only owner can manage ACLs, or users with MANAGE_ACL permission
    if (form.ownerUserId !== userId) {
      const userAcls = await db
        .select()
        .from(formsAcls)
        .where(
          and(
            eq(formsAcls.formId, formId),
            eq(formsAcls.principalType, 'user'),
            eq(formsAcls.principalId, userId)
          )
        );

      const hasManageAcl = userAcls.some(
        (a: { permissions: string[] }) => a.permissions.includes('MANAGE_ACL')
      );

      if (!hasManageAcl) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      }
    }

    await db.delete(formsAcls).where(eq(formsAcls.id, aclId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[forms] Delete ACL error:', error);
    return NextResponse.json({ error: 'Failed to delete ACL' }, { status: 500 });
  }
}
