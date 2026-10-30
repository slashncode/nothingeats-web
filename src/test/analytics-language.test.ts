import { expect, it, vi } from 'vitest';

// In a file of its own: every analytics module a test imports keeps listening to its i18next.
const client = {
    init: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
};
vi.mock('posthog-js', () => ({ default: client }));

it('keeps the UI language on the profile of a logged-in user, not of anonymous visitors', async () => {
    localStorage.setItem('ne.consent', 'granted');
    vi.resetModules();
    window.__NOTHINGEATS__ = { posthogKey: 'phc_test' };
    const { analyticsReady, identifyUser } = await import('../analytics/analytics');
    const { default: i18next } = await import('i18next');
    await i18next.changeLanguage('de');
    await analyticsReady();

    await i18next.changeLanguage('en');
    expect(client.setPersonProperties).not.toHaveBeenCalled();

    identifyUser({ id: 'user-1', locale: 'de' });
    expect(client.identify).toHaveBeenCalledWith('user-1', { locale: 'de', ui_language: 'en' });

    await i18next.changeLanguage('de');
    expect(client.setPersonProperties).toHaveBeenCalledExactlyOnceWith({ ui_language: 'de' });
});
