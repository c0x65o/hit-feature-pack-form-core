import { checkFormCoreAction } from './require-action';
/**
 * Resolve effective scope mode using a tree:
 * - entity override: form-core.{entity}.{verb}.scope.{mode}
 * - form-core default: form-core.{verb}.scope.{mode}
 * - fallback: own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveFormCoreScopeMode(request, args) {
    const { entity, verb } = args;
    const entityPrefix = entity ? `form-core.${entity}.${verb}.scope` : `form-core.${verb}.scope`;
    const globalPrefix = `form-core.${verb}.scope`;
    // Most restrictive wins (first match returned).
    const modes = ['none', 'own', 'ldd', 'any'];
    for (const m of modes) {
        const res = await checkFormCoreAction(request, `${entityPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    for (const m of modes) {
        const res = await checkFormCoreAction(request, `${globalPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    return 'own';
}
//# sourceMappingURL=scope-mode.js.map