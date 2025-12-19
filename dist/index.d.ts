/**
 * @hit/feature-pack-forms
 *
 * Runtime Forms feature pack: form builder + CRUD entries + search + reference linking.
 *
 * Pages are exported individually for optimal tree-shaking.
 */
export { FormList, FormListPage, FormBuilder, FormBuilderPage, EntryList, EntryListPage, EntryDetail, EntryDetailPage, EntryEdit, EntryEditPage, } from './pages/index';
export * from './hooks/index';
export { navContributions as nav } from './nav';
export { forms, formVersions, formFields, formEntries, formEntryHistory, formsAcls, principalTypeEnum as formsPrincipalTypeEnum, FORM_PERMISSIONS, type Form, type FormVersion, type FormField, type FormEntry, type FormEntryHistory, type FormsAcl, type FormPermission, type InsertForm, type InsertFormVersion, type InsertFormField, type InsertFormEntry, type InsertFormsAcl, } from './schema/forms';
export { FormAclModal } from './components/FormAclModal';
export { LinkedEntityTabs } from './components/LinkedEntityTabs';
export { MetricsPanel, type MetricsViewMetadata } from './components/MetricsPanel';
//# sourceMappingURL=index.d.ts.map