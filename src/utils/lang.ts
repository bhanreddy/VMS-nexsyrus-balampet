import i18n from '../i18n';

/**
 * Language-aware field selector.
 * Returns Telugu value when language is 'te' and translation exists,
 * otherwise returns English value.
 *
 * Usage: t_field(item.title, item.title_te)
 */
export function t_field(enValue: string | null | undefined, teValue?: string | null): string {
    if (i18n.language === 'te' && teValue && teValue.trim() !== '') return teValue;
    return enValue ?? '';
}
