/**
 * @hit/feature-pack-form-core
 *
 * Runtime Forms feature pack: form builder + CRUD entries + search + reference linking.
 *
 * Pages are exported individually for optimal tree-shaking.
 */
// Pages - exported individually for tree-shaking
export { FormList, default as FormListPage } from './widgets/FormList';
export { FormBuilder, default as FormBuilderPage } from './widgets/FormBuilder';
export { EntryList, default as EntryListPage } from './widgets/EntryList';
export { EntryDetail, default as EntryDetailPage } from './widgets/EntryDetail';
export { EntryEdit, default as EntryEditPage } from './widgets/EntryEdit';
// Hooks - exported individually for tree-shaking
export { useForms, useForm, useFormMutations, useEntries, useEntry, useEntryMutations, } from './hooks/useForms';
export { useLinkedForms, useLinkedFormEntries, } from './hooks/useLinkedEntities';
// Navigation config
export { navContributions as nav } from './nav';
// Schema exports - REMOVED from main index to avoid bundling drizzle-orm in client!
// Use: import { forms, ... } from '@hit/feature-pack-form-core/schema'
// Don't import from schema file at all - it pulls in drizzle-orm
// Permission constants - defined inline to avoid pulling in schema file
export const FORM_PERMISSIONS = {
    READ: 'READ',
    WRITE: 'WRITE',
    DELETE: 'DELETE',
    MANAGE_ACL: 'MANAGE_ACL',
};
// Component exports
export { FormAclModal } from './components/FormAclModal';
export { LinkedEntityTabs } from './components/LinkedEntityTabs';
export { MetricsPanel } from './components/MetricsPanel';
// Schema-driven UI helpers
export { splitLinkedEntityTabsExtra, wrapWithLinkedEntityTabsIfConfigured, entityKeyToFormsEntityKind, } from './schemaDriven/linkedEntityTabsExtra';
//# sourceMappingURL=index.js.map