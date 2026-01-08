/**
 * @hit/feature-pack-forms
 *
 * Runtime Forms feature pack: form builder + CRUD entries + search + reference linking.
 *
 * Pages are exported individually for optimal tree-shaking.
 */
// Pages
export { FormList, FormListPage, FormBuilder, FormBuilderPage, EntryList, EntryListPage, EntryDetail, EntryDetailPage, EntryEdit, EntryEditPage, } from './pages/index';
// Hooks
export * from './hooks/index';
// Navigation config
export { navContributions as nav } from './nav';
// Schema exports - REMOVED from main index to avoid bundling drizzle-orm in client!
// Use: import { forms, ... } from '@hit/feature-pack-forms/schema'
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
//# sourceMappingURL=index.js.map