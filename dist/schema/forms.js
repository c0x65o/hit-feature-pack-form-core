import { index, pgTable, varchar, text, boolean, integer, jsonb, timestamp, uuid, unique, pgEnum, } from 'drizzle-orm/pg-core';
/**
 * Runtime Forms schema
 *
 * This is a fixed schema that supports unlimited end-user forms without migrations.
 */
/**
 * Principal Types for ACL
 * Note: Uses a forms-specific enum name to avoid conflicts when multiple packs are installed
 */
export const formsPrincipalTypeEnum = pgEnum('forms_principal_type', ['user', 'group', 'role']);
export const forms = pgTable('forms', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    // Scope:
    // - private: only owner can see entries
    // - project: any authenticated user can see entries
    scope: varchar('scope', { length: 32 }).notNull().default('private'),
    isPublished: boolean('is_published').notNull().default(false),
    // Navigation config for published forms
    navShow: boolean('nav_show').notNull().default(true),
    navPlacement: varchar('nav_placement', { length: 32 }).notNull().default('under_forms'), // under_forms | top_level
    navGroup: varchar('nav_group', { length: 64 }).notNull().default('main'),
    navWeight: integer('nav_weight').notNull().default(500),
    navLabel: varchar('nav_label', { length: 255 }),
    navIcon: varchar('nav_icon', { length: 64 }),
    // Navigation parent path for nesting under projects or other nav items
    navParentPath: varchar('nav_parent_path', { length: 255 }),
    // Enable ACL sharing (UI kit ACL picker)
    aclEnabled: boolean('acl_enabled').notNull().default(false),
    ownerUserId: varchar('owner_user_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const formVersions = pgTable('form_versions', {
    id: varchar('id', { length: 255 }).primaryKey(),
    formId: varchar('form_id', { length: 255 }).notNull(),
    version: integer('version').notNull(),
    status: varchar('status', { length: 32 }).notNull().default('draft'), // draft | published
    // Optional list view configuration
    listConfig: jsonb('list_config'),
    createdByUserId: varchar('created_by_user_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
export const formFields = pgTable('form_fields', {
    id: varchar('id', { length: 255 }).primaryKey(),
    formId: varchar('form_id', { length: 255 }).notNull(),
    versionId: varchar('version_id', { length: 255 }).notNull(),
    key: varchar('key', { length: 255 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    order: integer('order').notNull().default(0),
    hidden: boolean('hidden').notNull().default(false),
    required: boolean('required').notNull().default(false),
    // Show this field in the datatable/list view
    showInTable: boolean('show_in_table').notNull().default(true),
    // Generic config for field types:
    // - select options
    // - validations
    // - reference config
    config: jsonb('config'),
    defaultValue: jsonb('default_value'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const formEntries = pgTable('form_entries', {
    id: varchar('id', { length: 255 }).primaryKey(),
    formId: varchar('form_id', { length: 255 }).notNull(),
    // Entry visibility is governed by forms.scope + createdByUserId
    createdByUserId: varchar('created_by_user_id', { length: 255 }).notNull(),
    updatedByUserId: varchar('updated_by_user_id', { length: 255 }),
    data: jsonb('data').notNull(),
    /**
     * Denormalized search string, maintained by the API on create/update.
     *
     * V1 uses a simple ILIKE/LIKE query. If you later enable FTS, you can add:
     * - a computed tsvector column, or
     * - a GIN index on to_tsvector(search_text)
     */
    searchText: text('search_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    formIdIdx: index('form_entries_form_id_idx').on(table.formId),
    searchTextIdx: index('form_entries_search_text_idx').on(table.searchText),
}));
export const formEntryHistory = pgTable('form_entry_history', {
    id: varchar('id', { length: 255 }).primaryKey(),
    entryId: varchar('entry_id', { length: 255 }).notNull(),
    formId: varchar('form_id', { length: 255 }).notNull(),
    version: integer('version').notNull(),
    changedByUserId: varchar('changed_by_user_id', { length: 255 }).notNull(),
    changeType: varchar('change_type', { length: 32 }).notNull(), // update | delete
    snapshot: jsonb('snapshot').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
/**
 * ACL Table (Access Control Entries)
 * Defines permissions for forms
 */
export const formsAcls = pgTable('forms_acls', {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: varchar('form_id', { length: 255 }).notNull(), // ID of the form
    principalType: formsPrincipalTypeEnum('principal_type').notNull(), // user | group | role
    principalId: varchar('principal_id', { length: 255 }).notNull(), // User email, group ID, or role name
    // Permissions: READ, WRITE, DELETE, MANAGE_ACL
    permissions: jsonb('permissions').$type().notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    formIdx: index('forms_acls_form_idx').on(table.formId),
    principalIdx: index('forms_acls_principal_idx').on(table.principalType, table.principalId),
    formPrincipalIdx: unique('forms_acls_form_principal_unique').on(table.formId, table.principalType, table.principalId), // One ACL entry per form+principal
}));
/**
 * Permission Constants
 * Simplified permissions for forms:
 * - READ: Can view form entries
 * - WRITE: Can create and edit entries
 * - DELETE: Can delete entries
 * - MANAGE_ACL: Can manage access control lists (grant/revoke permissions)
 */
export const FORM_PERMISSIONS = {
    READ: 'READ',
    WRITE: 'WRITE',
    DELETE: 'DELETE',
    MANAGE_ACL: 'MANAGE_ACL',
};
//# sourceMappingURL=forms.js.map