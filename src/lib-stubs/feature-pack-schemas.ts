/**
 * Stub for @/lib/feature-pack-schemas
 * 
 * This is a type-only stub for feature pack compilation.
 * At runtime, the consuming application provides the actual implementation
 * which is auto-generated from feature pack schemas.
 * 
 * This stub re-exports from the local schema file for type checking.
 */

// Re-export from the actual schema file for type checking during build
export {
  forms,
  formVersions,
  formFields,
  formEntries,
  formEntryHistory,
  formsAcls,
  formsPrincipalTypeEnum,
  FORM_PERMISSIONS,
  type Form,
  type InsertForm,
  type FormVersion,
  type InsertFormVersion,
  type FormField,
  type InsertFormField,
  type FormEntry,
  type InsertFormEntry,
  type FormEntryHistory,
  type FormsAcl,
  type InsertFormsAcl,
  type FormPermission,
} from '../schema/forms';
