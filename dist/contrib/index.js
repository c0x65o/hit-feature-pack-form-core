'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FormList } from '../widgets/FormList';
import { FormBuilder } from '../widgets/FormBuilder';
import { EntryList } from '../widgets/EntryList';
import { EntryDetail } from '../widgets/EntryDetail';
import { EntryEdit } from '../widgets/EntryEdit';
function resolveMode(spec) {
    const mode = String(spec?.widgetMode || spec?.mode || '').trim();
    return mode;
}
function runtimeFormsWidget(args) {
    const { mode, params, navigate, ui } = args;
    const { Alert } = ui || {};
    const formId = String(params?.id || '').trim();
    const entryId = String(params?.entryId || '').trim();
    if (mode.startsWith('entries') && !formId) {
        return Alert ? (_jsx(Alert, { variant: "warning", title: "Missing form id", children: "This route requires a form id to render entries." })) : (_jsx("div", { children: "Missing form id." }));
    }
    if (mode === 'entries.detail' && !entryId) {
        return Alert ? (_jsx(Alert, { variant: "warning", title: "Missing entry id", children: "This route requires an entry id to render the entry detail." })) : (_jsx("div", { children: "Missing entry id." }));
    }
    switch (mode) {
        case 'forms.list':
            return _jsx(FormList, { onNavigate: navigate });
        case 'forms.builder':
            return _jsx(FormBuilder, { id: formId || undefined, onNavigate: navigate });
        case 'entries.list':
            return _jsx(EntryList, { id: formId || undefined, onNavigate: navigate });
        case 'entries.detail':
            return _jsx(EntryDetail, { id: formId || undefined, entryId: entryId || undefined, onNavigate: navigate });
        case 'entries.edit':
            return _jsx(EntryEdit, { id: formId || undefined, entryId: entryId || undefined, onNavigate: navigate });
        default:
            return Alert ? (_jsxs(Alert, { variant: "warning", title: "Unsupported forms widget mode", children: ["Unknown widget mode: ", mode || 'missing', "."] })) : (_jsxs("div", { children: ["Unsupported forms widget mode: ", mode || 'missing', "."] }));
    }
}
export const contrib = {
    listWidgets: {
        'forms.runtime': ({ listSpec, navigate, ui, params }) => runtimeFormsWidget({ mode: resolveMode(listSpec) || 'forms.list', params, navigate, ui }),
    },
    detailWidgets: {
        'forms.runtime': ({ detailSpec, navigate, ui, params }) => runtimeFormsWidget({ mode: resolveMode(detailSpec) || 'entries.detail', params, navigate, ui }),
    },
    formWidgets: {
        'forms.runtime': ({ formSpec, navigate, ui, params }) => runtimeFormsWidget({ mode: resolveMode(formSpec) || 'entries.edit', params, navigate, ui }),
    },
};
export default contrib;
//# sourceMappingURL=index.js.map