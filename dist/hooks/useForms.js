'use client';
import { useCallback, useEffect, useState } from 'react';
// API base in the host app
const API_BASE = '/api/forms';
function getAuthHeaders() {
    if (typeof window === 'undefined')
        return {};
    const token = localStorage.getItem('hit_token');
    if (token)
        return { Authorization: `Bearer ${token}` };
    return {};
}
async function fetchApi(path, options) {
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
/**
 * List forms
 * @param adminMode - If true, lists ALL forms (requires admin role). Otherwise lists only forms user has READ ACL for.
 */
export function useForms(options = {}) {
    const { page = 1, pageSize = 25, search = '', adminMode = false } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            });
            if (search)
                params.set('search', search);
            if (adminMode)
                params.set('admin', 'true');
            const result = await fetchApi(`?${params.toString()}`);
            setData(result);
            setError(null);
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
    }, [page, pageSize, search, adminMode]);
    useEffect(() => {
        refresh();
    }, [refresh]);
    return { data, loading, error, refresh };
}
export function useForm(formId) {
    const [form, setForm] = useState(null);
    const [version, setVersion] = useState(null);
    const [loading, setLoading] = useState(Boolean(formId));
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        if (!formId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const result = await fetchApi(`/${formId}`);
            setForm(result.form);
            setVersion(result.version);
            setError(null);
        }
        catch (e) {
            setError(e);
        }
        finally {
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
    const [error, setError] = useState(null);
    const createForm = async (payload) => {
        setLoading(true);
        setError(null);
        try {
            return await fetchApi('', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    const updateForm = async (id, payload) => {
        setLoading(true);
        setError(null);
        try {
            return await fetchApi(`/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    const deleteForm = async (id) => {
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/${id}`, { method: 'DELETE' });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    const saveDraftFields = async (id, payload) => {
        setLoading(true);
        setError(null);
        try {
            return await fetchApi(`/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ draft: payload }),
            });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    return {
        createForm,
        updateForm,
        deleteForm,
        saveForm: async (id, payload) => {
            setLoading(true);
            setError(null);
            try {
                return await fetchApi(`/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload),
                });
            }
            catch (e) {
                setError(e);
                throw e;
            }
            finally {
                setLoading(false);
            }
        },
        saveDraftFields,
        loading,
        error,
    };
}
export function useEntries(options) {
    const { formId, page = 1, pageSize = 25, search = '', sortBy = 'updatedAt', sortOrder = 'desc' } = options;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
                sortBy,
                sortOrder,
            });
            if (search)
                params.set('search', search);
            const result = await fetchApi(`/${formId}/entries?${params.toString()}`);
            setData(result);
            setError(null);
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
    }, [formId, page, pageSize, search, sortBy, sortOrder]);
    useEffect(() => {
        refresh();
    }, [refresh]);
    return { data, loading, error, refresh };
}
export function useEntry(formId, entryId) {
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(Boolean(entryId));
    const [error, setError] = useState(null);
    const refresh = useCallback(async () => {
        if (!entryId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const result = await fetchApi(`/${formId}/entries/${entryId}`);
            setEntry(result);
            setError(null);
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
    }, [formId, entryId]);
    useEffect(() => {
        refresh();
    }, [refresh]);
    return { entry, loading, error, refresh };
}
export function useEntryMutations(formId) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const createEntry = async (data) => {
        setLoading(true);
        setError(null);
        try {
            return await fetchApi(`/${formId}/entries`, {
                method: 'POST',
                body: JSON.stringify({ data }),
            });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    const updateEntry = async (entryId, data) => {
        setLoading(true);
        setError(null);
        try {
            return await fetchApi(`/${formId}/entries/${entryId}`, {
                method: 'PUT',
                body: JSON.stringify({ data }),
            });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    const deleteEntry = async (entryId) => {
        setLoading(true);
        setError(null);
        try {
            await fetchApi(`/${formId}/entries/${entryId}`, { method: 'DELETE' });
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    };
    return { createEntry, updateEntry, deleteEntry, loading, error };
}
//# sourceMappingURL=useForms.js.map