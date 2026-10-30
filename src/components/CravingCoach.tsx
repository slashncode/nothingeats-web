import type { DishSummary } from '@slashncode/nothingeats-ui';
import type { TFunction } from 'i18next';
import type { CoachDish, CoachMessage } from '../api/assistant';
import { useChat } from '@ai-sdk/react';
import { Button, ChatBubble, DishCard, Form, Link, Modal, TextField } from '@slashncode/nothingeats-ui';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import { MessageCircleHeart, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Heading } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { capture } from '../analytics/analytics';
import { assistant, CHAT_ENDPOINT, coachFetch } from '../api/assistant';
import { ApiError } from '../api/http';
import { useSession } from '../auth/session';
import { currentLanguage } from '../i18n';
import { useAddToCart } from './cart';
import styles from './CravingCoach.module.scss';

/** Matches the assistant's limit; longer cravings are not cravings any more. */
const MAX_MESSAGE = 500;

// The conversation of this tab, per account: not a secret, only which chat to show again.
const storageKey = (userId: string) => `ne.coach.${userId}`;

function storedConversation(userId: string): string {
    try {
        const stored = sessionStorage.getItem(storageKey(userId));
        if (stored)
            return stored;
    }
    catch {}
    return newConversation(userId);
}

function newConversation(userId: string): string {
    const id = crypto.randomUUID();
    try {
        sessionStorage.setItem(storageKey(userId), id);
    }
    catch {}
    return id;
}

/** The assistant's error codes in the customer's language; never the server's text. */
function errorMessage(t: TFunction, error: Error): string {
    const code = error instanceof ApiError
        ? error.code
        : error.message;
    switch (code) {
        case 'COACH_TOO_MANY_MESSAGES':
        case 'COACH_DAILY_BUDGET_USED':
            return t('coach.errors.limit');
        case 'COACH_BUSY':
            return t('coach.errors.busy');
        default:
            return t('coach.errors.unavailable');
    }
}

function asDish(dish: CoachDish): DishSummary {
    return {
        id: dish.id,
        slug: dish.slug,
        name: dish.name,
        description: dish.description,
        priceCents: dish.priceCents,
        dietary: dish.dietary,
        allergens: dish.allergens,
        spiceLevel: dish.spiceLevel,
        calories: dish.calories,
        moods: dish.moods,
        available: true,
    };
}

/**
 * The Craving Coach: a button in the corner that opens the chat as a sheet on the right. Signed-in
 * customers chat; visitors are asked to sign in first (every answer costs model tokens).
 */
export function CravingCoach() {
    const { t } = useTranslation();
    const { state } = useSession();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    // At checkout the corner belongs to the pay button.
    if (location.pathname === '/checkout')
        return null;

    return (
        <>
            <Button
                className={styles.launcher}
                onPress={() => {
                    setIsOpen(true);
                    capture('coach_opened', { signed_in: state.status === 'authenticated' });
                }}
            >
                <MessageCircleHeart aria-hidden />
                {t('coach.open')}
            </Button>
            <Modal side="right" isOpen={isOpen} onOpenChange={setIsOpen} isDismissable className={styles.sheet}>
                <Dialog aria-labelledby="coach-title" className={styles.dialog}>
                    {state.status === 'authenticated'
                        ? <CoachChat userId={state.user.id} onClose={() => setIsOpen(false)} />
                        : <SignInFirst onClose={() => setIsOpen(false)} />}
                </Dialog>
            </Modal>
        </>
    );
}

function SheetHeader({ onClose, children }: { onClose: () => void; children?: React.ReactNode }) {
    const { t } = useTranslation();
    return (
        <header className={styles.header}>
            <div>
                <Heading slot="title" id="coach-title" className={styles.title}>{t('coach.title')}</Heading>
                <p className={styles.subtitle}>{t('coach.subtitle')}</p>
            </div>
            <div className={styles.headerActions}>
                {children}
                <Button variant="ghost" size="icon" aria-label={t('coach.close')} onPress={onClose}>
                    <X aria-hidden />
                </Button>
            </div>
        </header>
    );
}

function SignInFirst({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const location = useLocation();
    return (
        <>
            <SheetHeader onClose={onClose} />
            <div className={styles.signIn}>
                <p>{t('coach.signIn')}</p>
                <Link href={`/login?redirect=${encodeURIComponent(location.href)}`}>{t('nav.login')}</Link>
            </div>
        </>
    );
}

/** Loads the conversation of this tab first, so the chat starts with what was said before. */
function CoachChat({ userId, onClose }: { userId: string; onClose: () => void }) {
    const { t } = useTranslation();
    const [conversationId, setConversationId] = useState(() => storedConversation(userId));
    const stored = useQuery({
        queryKey: ['assistant', 'conversation', conversationId],
        queryFn: async () => {
            try {
                return (await assistant.conversation(conversationId)).messages;
            }
            catch (error) {
                // Not saved yet (or gone): a fresh chat under this id.
                if (error instanceof ApiError && error.code === 'CONVERSATION_NOT_FOUND')
                    return [];
                throw error;
            }
        },
        staleTime: Infinity,
        retry: false,
    });

    function restart() {
        setConversationId(newConversation(userId));
        capture('coach_conversation_started', {});
    }

    const restartButton = (
        <Button variant="ghost" size="icon" aria-label={t('coach.newConversation')} onPress={restart}>
            <RotateCcw aria-hidden />
        </Button>
    );

    return (
        <>
            <SheetHeader onClose={onClose}>{restartButton}</SheetHeader>
            {stored.isPending && <p className={styles.status}>{t('coach.loading')}</p>}
            {stored.isError && <p role="alert" className={styles.error}>{t('coach.errors.unavailable')}</p>}
            {stored.isSuccess && <ChatSession key={conversationId} id={conversationId} initial={stored.data} />}
        </>
    );
}

function ChatSession({ id, initial }: { id: string; initial: CoachMessage[] }) {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const logRef = useRef<HTMLDivElement>(null);
    const cart = useAddToCart();
    const transport = useMemo(() => new DefaultChatTransport<CoachMessage>({
        api: CHAT_ENDPOINT,
        fetch: coachFetch,
        // Only the newest message travels: the assistant keeps the conversation.
        prepareSendMessagesRequest: ({ id: chatId, messages }) => ({
            body: {
                id: chatId,
                language: currentLanguage(),
                message: messages.at(-1),
            },
        }),
    }), []);
    const { messages, sendMessage, status, error, clearError } = useChat<CoachMessage>({ id, messages: initial, transport });
    const busy = status === 'submitted' || status === 'streaming';

    // New messages scroll into view.
    useEffect(() => {
        const log = logRef.current;
        if (log)
            log.scrollTop = log.scrollHeight;
    }, [messages, status]);

    function send(message: string, suggestion: boolean) {
        const trimmed = message.trim();
        if (!trimmed || busy)
            return;
        clearError();
        capture('coach_message_sent', {
            length: trimmed.length,
            suggestion,
            turn: messages.filter(it => it.role === 'user').length + 1,
        });
        void sendMessage({ text: trimmed });
        setText('');
    }

    const suggestions = t('coach.suggestions', { returnObjects: true }) as string[];

    return (
        <>
            <div ref={logRef} role="log" aria-label={t('coach.log')} className={styles.log}>
                {messages.length === 0 && (
                    <div className={styles.intro}>
                        <ChatBubble from="coach">{t('coach.welcome')}</ChatBubble>
                        <ul className={styles.suggestions} aria-label={t('coach.suggestionsLabel')}>
                            {suggestions.map(suggestion => (
                                <li key={suggestion}>
                                    <Button variant="outline" size="sm" onPress={() => send(suggestion, true)}>{suggestion}</Button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {messages.map(message => (
                    <Message key={message.id} message={message} onAdd={dish => void cart.add(asDish(dish), dish.restaurant.slug, 'coach')} />
                ))}
                {status === 'submitted' && <ChatBubble from="coach" pending />}
                {error && <p role="alert" className={styles.error}>{errorMessage(t, error)}</p>}
            </div>
            <Form
                className={styles.composer}
                onSubmit={(event) => {
                    event.preventDefault();
                    send(text, false);
                }}
            >
                <TextField
                    aria-label={t('coach.inputLabel')}
                    placeholder={t('coach.placeholder')}
                    value={text}
                    onChange={setText}
                    maxLength={MAX_MESSAGE}
                    autoComplete="off"
                    className={styles.input}
                />
                <Button type="submit" isDisabled={busy || text.trim() === ''}>{t('coach.send')}</Button>
            </Form>
            {cart.dialog}
        </>
    );
}

function Message({ message, onAdd }: { message: CoachMessage; onAdd: (dish: CoachDish) => void }) {
    const { t } = useTranslation();
    if (message.role === 'user') {
        const text = message.parts.flatMap(part => (part.type === 'text'
            ? [part.text]
            : [])).join(' ');
        return <ChatBubble from="customer">{text}</ChatBubble>;
    }
    return (
        <>
            {message.parts.map((part, index) => {
                const key = `${message.id}-${index}`;
                switch (part.type) {
                    case 'text':
                        return part.text.trim()
                            ? <ChatBubble key={key} from="coach">{part.text}</ChatBubble>
                            : null;
                    case 'tool-searchDishes':
                        return part.input?.query
                            ? (
                                    <p key={key} className={styles.status}>
                                        {part.state === 'output-available'
                                            ? t('coach.searched', { query: part.input.query })
                                            : t('coach.searching', { query: part.input.query })}
                                    </p>
                                )
                            : null;
                    case 'tool-recommendDishes':
                        return part.state === 'output-available'
                            ? (
                                    <ul key={key} className={styles.dishes} aria-label={t('coach.recommendations')}>
                                        {part.output.shown.map(dish => (
                                            <li key={dish.id} className={styles.recommendation}>
                                                <p className={styles.reason}>{dish.reason}</p>
                                                <DishCard
                                                    dish={asDish(dish)}
                                                    restaurant={{ name: dish.restaurant.name, href: `/restaurants/${dish.restaurant.slug}` }}
                                                    headingLevel={3}
                                                    onAdd={() => onAdd(dish)}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                )
                            : null;
                    default:
                        return null;
                }
            })}
        </>
    );
}
