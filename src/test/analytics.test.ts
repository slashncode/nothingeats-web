import { beforeEach, describe, expect, it, vi } from 'vitest';

// A configured project key and a fake SDK; the module under test is imported fresh per test.
const client = {
    init: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
    capture: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => 'visitor-1'),
    get_session_id: vi.fn(() => 'session-1'),
};
vi.mock('posthog-js', () => ({ default: client }));

async function analytics() {
    vi.resetModules();
    window.__NOTHINGEATS__ = { posthogKey: 'phc_test' };
    return import('../analytics/analytics');
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('consent gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('does not load PostHog before consent, not even opted out', async () => {
        const { initAnalytics, capture, identifyUser } = await analytics();

        initAnalytics();
        identifyUser({ id: 'user-1', locale: 'de' });
        capture('language_changed', { from: 'de', to: 'en' });
        await settle();

        expect(client.init).not.toHaveBeenCalled();
        expect(client.capture).not.toHaveBeenCalled();
        expect(client.identify).not.toHaveBeenCalled();
    });

    it('adds the PostHog ids to API requests only once the visitor agreed and PostHog is loaded', async () => {
        const { analyticsHeaders, setConsent } = await analytics();
        expect(analyticsHeaders()).toEqual({});

        setConsent(true);
        await settle();

        expect(analyticsHeaders()).toEqual({ 'X-POSTHOG-DISTINCT-ID': 'visitor-1', 'X-POSTHOG-SESSION-ID': 'session-1' });
    });

    it('lets loaders wait for PostHog only when the visitor agreed', async () => {
        const first = await analytics();
        await first.analyticsReady();
        expect(client.init).not.toHaveBeenCalled();

        localStorage.setItem('ne.consent', 'granted');
        const second = await analytics();
        await second.analyticsReady();
        expect(client.init).toHaveBeenCalledOnce();
    });

    it('loads on "yes" and identifies a user who logged in before', async () => {
        const { setConsent, identifyUser } = await analytics();
        identifyUser({ id: 'user-1', locale: 'de' });

        setConsent(true);
        await settle();

        expect(client.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({ persistence: 'localStorage+cookie' }));
        expect(client.identify).toHaveBeenCalledWith('user-1', expect.objectContaining({ locale: 'de' }));
        expect(localStorage.getItem('ne.consent')).toBe('granted');
    });

    it('keeps events from the moment of consent until the SDK has loaded', async () => {
        const { setConsent, capture } = await analytics();

        setConsent(true);
        capture('dish_add_clicked', {
            dish_id: 'dish-1',
            restaurant_slug: 'phantom-pizza',
            price_cents: 1090,
            source: 'menu',
        });
        await settle();

        expect(client.capture).toHaveBeenCalledWith('dish_add_clicked', {
            dish_id: 'dish-1',
            restaurant_slug: 'phantom-pizza',
            price_cents: 1090,
            source: 'menu',
        });
    });

    it('loads on start for visitors who agreed earlier, and undoes an old opt-out', async () => {
        localStorage.setItem('ne.consent', 'granted');
        client.has_opted_out_capturing.mockReturnValueOnce(true);
        const { initAnalytics } = await analytics();

        initAnalytics();
        await settle();

        expect(client.init).toHaveBeenCalled();
        expect(client.opt_in_capturing).toHaveBeenCalled();
    });

    it('stops and forgets on withdrawal', async () => {
        localStorage.setItem('ne.consent', 'granted');
        const { initAnalytics, setConsent } = await analytics();
        initAnalytics();
        await settle();

        setConsent(false);

        expect(client.opt_out_capturing).toHaveBeenCalled();
        expect(client.reset).toHaveBeenCalled();
        expect(localStorage.getItem('ne.consent')).toBe('denied');
    });
});
