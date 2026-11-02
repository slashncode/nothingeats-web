import { ArticleCard, Link } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { backofficeQueries } from '../api/backoffice';
import { Page } from '../components/Page';
import { currentLanguage } from '../i18n';
import { ErrorState } from './__root';
import styles from './blog.module.scss';

interface ArticleSearch {
    category?: string;
    tag?: string;
    page?: number;
}

export const Route = createFileRoute('/blog/')({
    validateSearch: (search: Record<string, unknown>): ArticleSearch => ({
        category: typeof search.category === 'string' && search.category
            ? search.category
            : undefined,
        tag: typeof search.tag === 'string' && search.tag
            ? search.tag
            : undefined,
        page: Number(search.page) > 1
            ? Number(search.page)
            : undefined,
    }),
    loaderDeps: ({ search }) => search,
    loader: ({ context, deps }) => Promise.all([
        context.queryClient.ensureQueryData(backofficeQueries.articles(currentLanguage(), deps, deps.page)),
        context.queryClient.ensureQueryData(backofficeQueries.categories(currentLanguage())),
    ]),
    component: Blog,
});

function Blog() {
    const { t } = useTranslation();
    const search = Route.useSearch();
    const language = currentLanguage();
    const articles = useQuery(backofficeQueries.articles(language, search, search.page));
    const categories = useQuery(backofficeQueries.categories(language));
    const tags = useQuery(backofficeQueries.tags(language));
    const page = articles.data?.page ?? 1;
    const tagName = tags.data?.find(tag => tag.slug === search.tag)?.name ?? search.tag;

    return (
        <Page>
            <h1>{t('blog.title')}</h1>
            <p className={styles.lead}>{t('blog.lead')}</p>
            <nav aria-label={t('blog.categories')} className={styles.filters}>
                <Link
                    href="/blog"
                    variant="secondary"
                    aria-current={!search.category
                        ? 'page'
                        : undefined}
                    className={clsx(styles.filter, !search.category && styles.current)}
                    onPress={() => capture('articles_filtered', { filter: 'category', value: 'all' })}
                >
                    {t('blog.all')}
                </Link>
                {categories.data?.map(category => (
                    <Link
                        key={category.slug}
                        href={`/blog?category=${encodeURIComponent(category.slug)}`}
                        variant="secondary"
                        aria-current={search.category === category.slug
                            ? 'page'
                            : undefined}
                        className={clsx(styles.filter, search.category === category.slug && styles.current)}
                        onPress={() => capture('articles_filtered', { filter: 'category', value: category.slug })}
                    >
                        {category.name}
                    </Link>
                ))}
            </nav>
            {search.tag && (
                <p className={styles.tag}>
                    {t('blog.taggedWith', { tag: tagName })}
                    <Link
                        href={search.category
                            ? `/blog?category=${encodeURIComponent(search.category)}`
                            : '/blog'}
                        aria-label={t('blog.clearTag')}
                    >
                        <X aria-hidden size={16} />
                    </Link>
                </p>
            )}
            {articles.isError && <ErrorState onRetry={() => void articles.refetch()} />}
            {articles.isSuccess && articles.data.items.length === 0 && <p className={styles.empty}>{t('blog.empty')}</p>}
            <ul className={styles.grid}>
                {articles.data?.items.map(article => (
                    <li key={article.slug}>
                        <ArticleCard article={article} href={`/blog/${article.slug}`} headingLevel={2} />
                    </li>
                ))}
            </ul>
            {articles.data && articles.data.totalPages > 1 && (
                <nav aria-label={t('blog.pages')} className={styles.pages}>
                    {page > 1 && <Link href={pageHref(search, page - 1)}>{t('blog.previous')}</Link>}
                    <span>{t('blog.page', { page, pages: articles.data.totalPages })}</span>
                    {page < articles.data.totalPages && <Link href={pageHref(search, page + 1)}>{t('blog.next')}</Link>}
                </nav>
            )}
        </Page>
    );
}

function pageHref(search: ArticleSearch, page: number) {
    const params = new URLSearchParams();
    if (search.category)
        params.set('category', search.category);
    if (search.tag)
        params.set('tag', search.tag);
    if (page > 1)
        params.set('page', String(page));
    const query = params.toString();
    return query
        ? `/blog?${query}`
        : '/blog';
}
