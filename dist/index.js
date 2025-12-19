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
// Schema exports
export { forms, formVersions, formFields, formEntries, formEntryHistory, formsAcls, principalTypeEnum as formsPrincipalTypeEnum, FORM_PERMISSIONS, } from './schema/forms';
// Component exports
export { FormAclModal } from './components/FormAclModal';
export { LinkedEntityTabs } from './components/LinkedEntityTabs';
export { MetricsPanel } from './components/MetricsPanel';
//# sourceMappingURL=index.js.map