export type PrincipalType = 'user' | 'group' | 'role';

/**
 * Minimal request shape needed for principal expansion.
 * Compatible with Next.js `NextRequest` (and similar request abstractions).
 */
export interface RequestLike {
  headers: { get(name: string): string | null };
  nextUrl?: { protocol?: string; host?: string };
}

export interface UserClaimsLike {
  sub: string;
  email?: string;
  roles?: string[];
  groups?: string[];
}

export interface ResolvedUserPrincipals {
  userId: string;
  userEmail: string;
  roles: string[];
  groupIds: string[];
}

export interface ResolveUserPrincipalsOptions {
  request?: RequestLike;
  user: UserClaimsLike;
  includeTokenGroups?: boolean;
  includeAuthMeGroups?: boolean;
  /**
   * Fail fast when group expansion cannot be performed.
   * Defaults to false for backwards compatibility.
   */
  strict?: boolean;
  extraGroupIds?: () => Promise<string[]>;
}

export declare function resolveUserPrincipals(
  options: ResolveUserPrincipalsOptions
): Promise<ResolvedUserPrincipals>;

