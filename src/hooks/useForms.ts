'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// API base in the host app
const API_BASE = '/api/forms';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const token = localStorage.getItem('hit_token');
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export type NavPlacement = 'under_forms' | 'top_level';
export type FieldType =
  | 'text'
  | 'url'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'checkbox'
  | 'reference'
  | 'entity_reference';

export interface FormRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  navShow: boolean;
  navPlacement: NavPlacement;
  navGroup: string;
  navWeight: number;
  navLabel: string | null;
  navIcon: string | null;
  navParentPath: string | null;
  aclEnabled: boolean;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormFieldRecord {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  order: number;
  hidden: boolean;
  required: boolean;
  showInTable: boolean;
  config: any;
  defaultValue: any;
}

export interface FormVersionRecord {
  id: string;
  formId: string;
  version: number;
  status: 'draft' | 'published';
  listConfig?: any;
  fields: FormFieldRecord[];
}

export interface FormEntryRecord {
  id: string;
  formId: string;
  createdByUserId: string;
  updatedByUserId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * List forms
 * @param adminMode - If true, lists ALL forms (requires admin role). Otherwise lists only forms user has READ ACL for.
 */
export function useForms(options: { page?: number; pageSize?: number; search?: string; adminMode?: boolean } = {}) {
  const { page = 1, pageSize = 25, search = '', adminMode = false } = options;
  const [data, setData] = useState<PaginatedResponse<FormRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (adminMode) params.set('admin', 'true');

      const result = await fetchApi<PaginatedResponse<FormRecord>>(`?${params.toString()}`);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, adminMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useForm(formId: string | undefined) {
  const [form, setForm] = useState<FormRecord | null>(null);
  const [version, setVersion] = useState<FormVersionRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(formId));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!formId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<{ form: FormRecord; version: FormVersionRecord }>(`/${formId}`);
      setForm(result.form);
      setVersion(result.version);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { form, version, loading, error, refresh };
}

export function useFormMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createForm = async (payload: {
    name: string;
    slug?: string;
    description?: string;
    navShow?: boolean;
    navPlacement?: NavPlacement;
    navGroup?: string;
    navWeight?: number;
    navLabel?: string;
    navIcon?: string;
    navParentPath?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchApi<FormRecord>('', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const updateForm = async (id: string, payload: Partial<{ name: string; description: string }>) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchApi<FormRecord>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const deleteForm = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await fetchApi(`/${id}`, { method: 'DELETE' });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const saveDraftFields = async (id: string, payload: { fields: Array<Partial<FormFieldRecord>>; listConfig?: any }) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchApi<{ success: boolean }>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ draft: payload }),
      });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    createForm,
    updateForm,
    deleteForm,
    saveForm: async (
      id: string,
      payload: Partial<{
        name: string;
        description: string;
        navShow: boolean;
        navPlacement: NavPlacement;
        navGroup: string;
        navWeight: number;
        navLabel: string;
        navIcon: string;
        navParentPath: string;
        draft: { fields: Array<Partial<FormFieldRecord>>; listConfig?: any };
      }>
    ) => {
      setLoading(true);
      setError(null);
      try {
        return await fetchApi<{ success: boolean }>(`/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    saveDraftFields,
    loading,
    error,
  };
}

export function useEntries(options: {
  formId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const { formId, page = 1, pageSize = 25, search = '', sortBy = 'updatedAt', sortOrder = 'desc' } = options;
  const [data, setData] = useState<PaginatedResponse<FormEntryRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortOrder,
      });
      if (search) params.set('search', search);

      const result = await fetchApi<PaginatedResponse<FormEntryRecord>>(`/${formId}/entries?${params.toString()}`);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [formId, page, pageSize, search, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useEntry(formId: string, entryId: string | undefined) {
  const [entry, setEntry] = useState<FormEntryRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(entryId));
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!entryId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const result = await fetchApi<FormEntryRecord>(`/${formId}/entries/${entryId}`);
      setEntry(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [formId, entryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entry, loading, error, refresh };
}

export function useEntryMutations(formId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createEntry = async (data: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchApi<FormEntryRecord>(`/${formId}/entries`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = async (entryId: string, data: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      return await fetchApi<FormEntryRecord>(`/${formId}/entries/${entryId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ data }),
        }
      );
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    setLoading(true);
    setError(null);
    try {
      await fetchApi(`/${formId}/entries/${entryId}`, { method: 'DELETE' });
    } catch (e) {
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { createEntry, updateEntry, deleteEntry, loading, error };
}
