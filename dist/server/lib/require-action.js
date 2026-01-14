import { checkActionPermission, requireActionPermission, } from '@hit/feature-pack-auth-core/server/lib/action-check';
export async function checkFormCoreAction(request, actionKey, options) {
    const debug = options?.debug ?? process.env.DEBUG_FORM_CORE_AUTHZ === '1';
    return checkActionPermission(request, actionKey, {
        logPrefix: 'Form-Core',
        debug,
    });
}
export async function requireFormCoreAction(request, actionKey) {
    const debug = process.env.DEBUG_FORM_CORE_AUTHZ === '1';
    return requireActionPermission(request, actionKey, {
        logPrefix: 'Form-Core',
        debug,
    });
}
//# sourceMappingURL=require-action.js.map