import type { ErrorComponentProps } from '@tanstack/react-router';
import { Link, Photo } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { useDateFormatter } from 'react-aria';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { backofficeQueries } from '../api/backoffice';
import { ApiError } from '../api/http';
import { Page } from '../components/Page';
import { currentLanguage } from '../i18n';
import { ErrorState } from './__root';
import styles from './blog.module.scss';

export const Route = createFileRoute('/blog/$slug')({
    loader: ({ context, params }) => context.queryClient.ensureQueryData(backofficeQueries.article(currentLanguage(), params.slug)),
    component: ArticlePage,
    errorComponent: ArticleError,
});

function ArticlePage() {
    const { t } = useTranslation();
    const date = useDateFormatter({ dateStyle: 'long' });
    const { slug } = Route.useParams();
    const article = useQuery(backofficeQueries.article(currentLanguage(), slug));
    const viewed = article.data?.slug;
    const category = article.data?.category?.slug ?? null;

    useEffect(() => {
        if (viewed)
            capture('article_viewed', { slug: viewed, category });
    }, [viewed, category]);

    if (!article.data)
        return null;
    const { title, cover, publishedAt, readingMinutes, tags, bodyHtml } = article.data;

    return (
        <Page narrow>
            <Link href="/blog" className={styles.back}>
                <ArrowLeft aria-hidden size={16} />
                {t('blog.back')}
            </Link>
            <article className={styles.article}>
                {cover && <Photo image={cover} variant="wide" priority className={styles.cover} />}
                {article.data.category && (
                    <Link href={`/blog?category=${encodeURIComponent(article.data.category.slug)}`} variant="secondary" className={styles.category}>
                        {article.data.category.name}
                    </Link>
                )}
                <h1>{title}</h1>
                <p className={styles.meta}>
                    {publishedAt && <time dateTime={publishedAt}>{date.format(new Date(publishedAt))}</time>}
                    {' · '}
                    {t('blog.readingMinutes', { count: readingMinutes })}
                </p>
                {/* The backoffice escapes text and checks links (its Lexical converter); editors are admins. */}
                <div className={styles.body} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
                {tags.length > 0 && (
                    <ul aria-label={t('blog.tags')} className={styles.tags}>
                        {tags.map(tag => (
                            <li key={tag.slug}>
                                <Link href={`/blog?tag=${encodeURIComponent(tag.slug)}`} variant="secondary">{`#${tag.name}`}</Link>
                            </li>
                        ))}
                    </ul>
                )}
            </article>
        </Page>
    );
}

function ArticleError({ error, reset }: ErrorComponentProps) {
    const { t } = useTranslation();
    if (error instanceof ApiError && error.code === 'ARTICLE_NOT_FOUND') {
        return (
            <Page narrow>
                <h1>{t('blog.notFound')}</h1>
                <Link href="/blog">{t('blog.back')}</Link>
            </Page>
        );
    }
    return <ErrorState onRetry={reset} />;
}
