'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { AclPicker } from '@hit/ui-kit';
import { FORM_PERMISSIONS } from '../schema/forms';
function getAuthHeaders() {
    if (typeof window === 'undefined')
        return {};
    const token = localStorage.getItem('hit_token');
    if (token)
        return { Authorization: `Bearer ${token}` };
    return {};
}
export function FormAclModal({ formId, isOpen, onClose, onUpdate }) {
    const { Modal, Alert } = useUi();
    const [acls, setAcls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (isOpen && formId) {
            loadAcls();
        }
    }, [isOpen, formId]);
    async function loadAcls() {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/forms/${formId}/acl`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                credentials: 'include',
            });
            if (!response.ok) {
                throw new Error('Failed to load ACLs');
            }
            const data = await response.json();
            setAcls(Array.isArray(data.items) ? data.items : []);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load ACLs'));
        }
        finally {
            setLoading(false);
        }
    }
    // Convert FormsAcl to AclEntry
    const aclEntries = useMemo(() => {
        return acls.map(acl => ({
            id: acl.id,
            principalType: acl.principalType,
            principalId: acl.principalId,
            permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
        }));
    }, [acls]);
    async function handleAdd(entry) {
        try {
            setError(null);
            const response = await fetch(`/api/forms/${formId}/acl`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    principalType: entry.principalType,
                    principalId: entry.principalId,
                    permissions: entry.permissions,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to create ACL' }));
                throw new Error(errorData.error || 'Failed to create ACL');
            }
            await loadAcls();
            onUpdate?.();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create ACL'));
            throw err;
        }
    }
    async function handleRemove(entry) {
        if (!entry.id) {
            throw new Error('Cannot remove entry without ID');
        }
        try {
            const response = await fetch(`/api/forms/${formId}/acl/${entry.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                credentials: 'include',
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to remove ACL' }));
                throw new Error(errorData.error || 'Failed to remove ACL');
            }
            await loadAcls();
            onUpdate?.();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to remove ACL'));
            throw err;
        }
    }
    // Forms hierarchical permissions configuration
    const formAclConfig = useMemo(() => ({
        principals: {
            users: true,
            groups: true,
            roles: true,
        },
        mode: 'hierarchical',
        hierarchicalPermissions: [
            {
                key: 'full',
                label: 'Full Control',
                description: 'Read, write, delete entries, and manage access',
                priority: 100,
                includes: [FORM_PERMISSIONS.READ, FORM_PERMISSIONS.WRITE, FORM_PERMISSIONS.DELETE, FORM_PERMISSIONS.MANAGE_ACL],
            },
            {
                key: 'edit',
                label: 'Can Edit',
                description: 'Read, create, and edit entries',
                priority: 50,
                includes: [FORM_PERMISSIONS.READ, FORM_PERMISSIONS.WRITE],
            },
            {
                key: 'view',
                label: 'View Only',
                description: 'View entries only',
                priority: 25,
                includes: [FORM_PERMISSIONS.READ],
            },
        ],
        labels: {
            title: 'Form Sharing',
            addButton: 'Add Access',
            removeButton: 'Remove',
            emptyMessage: 'No access permissions set. Click "Add Access" to grant permissions.',
        },
    }), []);
    return (_jsx(Modal, { open: isOpen, onClose: onClose, title: "Form Sharing", size: "lg", children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '1rem' }, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsx(AclPicker, { config: formAclConfig, entries: aclEntries, loading: loading, error: error?.message || null, onAdd: handleAdd, onRemove: handleRemove })] }) }));
}
export default FormAclModal;
//# sourceMappingURL=FormAclModal.js.map