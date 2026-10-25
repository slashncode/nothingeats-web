import { beforeEach, describe, expect, it, vi } from 'vitest';

// A configured project key and a fake SDK; the module under test is imported fresh per test.
const client = {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
    reset: vi.fn(),
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

    it('loads on "yes" and identifies a user who logged in before', async () => {
        const { setConsent, identifyUser } = await analytics();
        identifyUser({ id: 'user-1', locale: 'de' });

        setConsent(true);
        await settle();

        expect(client.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({ persistence: 'localStorage+cookie' }));
        expect(client.identify).toHaveBeenCalledWith('user-1', { locale: 'de' });
        expect(localStorage.getItem('ne.consent')).toBe('granted');
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
