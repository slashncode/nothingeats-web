import type { SearchSuggestion } from '@slashncode/nothingeats-ui';
import { SearchBox } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { searchQueries } from '../api/search';
import { currentLanguage } from '../i18n';

const DEBOUNCE_MS = 150;

function useDebounced<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(setDebounced, delay, value);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

/**
 * The search box with completions. Submitting opens the search page; a restaurant suggestion
 * opens its menu, a dish suggestion searches for the dish. [keepFilters] keeps the filters of
 * the search page for a new query.
 */
export function SiteSearch({ initial = '', keepFilters = false, className }: { initial?: string; keepFilters?: boolean; className?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [value, setValue] = useState(initial);
    const prefix = useDebounced(value.trim(), DEBOUNCE_MS);
    const suggestions = useQuery(searchQueries.suggestions(currentLanguage(), prefix));

    function search(text: string) {
        const q = text.trim() || undefined;
        void navigate({
            to: '/search',
            search: keepFilters
                ? (previous: Record<string, unknown>) => ({ ...previous, q })
                : { q },
        });
    }

    function pick(suggestion: SearchSuggestion) {
        const items = suggestions.data?.items ?? [];
        capture('search_suggestion_selected', {
            kind: suggestion.kind,
            position: items.indexOf(suggestion) + 1,
        });
        if (suggestion.kind === 'restaurant') {
            void navigate({
                to: '/restaurants/$slug',
                params: { slug: suggestion.target },
            });
        }
        else {
            search(suggestion.text);
        }
    }

    return (
        <SearchBox
            value={value}
            onChange={setValue}
            suggestions={prefix.length >= 2 && value.trim().length >= 2
                ? suggestions.data?.items ?? []
                : []}
            onSubmit={search}
            onSuggestion={pick}
            placeholder={t('search.placeholder')}
            className={className}
        />
    );
}
