import { NextRequest, NextResponse } from 'next/server';

type ActionCheckResult = {
  ok: boolean;
  source?: string;
};

type ActionCheckOptions = {
  /**
   * When true, log all checks/results to console.
   * When false (default), log only error conditions (no token / auth unreachable / non-2xx).
   * You can also enable globally via DEBUG_FORM_CORE_AUTHZ=1.
   */
  debug?: boolean;
};

function getTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('hit_token')?.value || null;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  const rawCookie = request.headers.get('cookie') || '';
  if (rawCookie) {
    const parts = rawCookie.split(';').map((c) => c.trim());
    for (const p of parts) {
      const eq = p.indexOf('=');
      if (eq <= 0) continue;
      const name = p.slice(0, eq);
      const value = p.slice(eq + 1);
      if (name === 'hit_token' && value) return value;
    }
  }

  return null;
}

function baseUrlFromRequest(request: NextRequest): string {
  const proto =
    request.headers.get('x-forwarded-proto') ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    '';
  return `${proto}://${host}`;
}

export async function checkFormCoreAction(
  request: NextRequest,
  actionKey: string,
  options?: ActionCheckOptions
): Promise<ActionCheckResult> {
  const debug = options?.debug ?? process.env.DEBUG_FORM_CORE_AUTHZ === '1';
  const token = getTokenFromRequest(request);
  if (!token) {
    if (debug) console.log(`[Form-Core Action Check] ${actionKey}: No token found`);
    return { ok: false, source: 'unauthenticated' };
  }

  const baseUrl = baseUrlFromRequest(request);
  const url = `${baseUrl}/api/proxy/auth/permissions/actions/check/${encodeURIComponent(actionKey)}`;
  if (debug) console.log(`[Form-Core Action Check] ${actionKey}: Checking via ${url}`);
  
  const res = await fetch(
    url,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // Ensure cookies flow too (proxy can also read hit_token cookie)
      credentials: 'include',
    }
  ).catch((e) => {
    console.log(`[Form-Core Action Check] ${actionKey}: Fetch error:`, e);
    return null;
  });

  if (!res) {
    console.log(`[Form-Core Action Check] ${actionKey}: Auth unreachable (no response)`);
    return { ok: false, source: 'auth_unreachable' };
  }
  
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.log(`[Form-Core Action Check] ${actionKey}: Auth returned status ${res.status}:`, errorText);
    return { ok: false, source: `auth_status_${res.status}` };
  }

  const json = (await res.json().catch(() => null)) as any;
  const ok = Boolean(json?.has_permission ?? json?.hasPermission ?? false);
  if (debug) console.log(`[Form-Core Action Check] ${actionKey}: Result`, { ok, source: json?.source, response: json });
  return { ok, source: String(json?.source || '') || undefined };
}

export async function requireFormCoreAction(
  request: NextRequest,
  actionKey: string
): Promise<NextResponse | null> {
  const result = await checkFormCoreAction(request, actionKey);
  if (result.ok) return null;

  // Treat missing/invalid auth as 401; otherwise 403.
  const status = result.source === 'unauthenticated' ? 401 : 403;
  const error =
    status === 401 ? 'Unauthorized' : 'Not authorized';

  return NextResponse.json(
    {
      error,
      action: actionKey,
    },
    { status }
  );
}
