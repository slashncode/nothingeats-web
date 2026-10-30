import { expect, it, vi } from 'vitest';

// In a file of its own: every analytics module a test imports keeps listening to its i18next.
const client = {
    init: vi.fn(),
    identify: vi.fn(),
    setPersonProperties: vi.fn(),
    set_config: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
};
vi.mock('posthog-js', () => ({ default: client }));

it('shows surveys in the UI language and keeps it on the profile of a logged-in user only', async () => {
    localStorage.setItem('ne.consent', 'granted');
    vi.resetModules();
    window.__NOTHINGEATS__ = { posthogKey: 'phc_test' };
    const { analyticsReady, identifyUser } = await import('../analytics/analytics');
    const { default: i18next } = await import('i18next');
    await i18next.changeLanguage('de');
    await analyticsReady();

    expect(client.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({ override_display_language: 'de' }));

    await i18next.changeLanguage('en');
    expect(client.setPersonProperties).not.toHaveBeenCalled();
    // Surveys switch language for everyone, visitors included.
    expect(client.set_config).toHaveBeenLastCalledWith({ override_display_language: 'en' });

    identifyUser({ id: 'user-1', locale: 'de' });
    expect(client.identify).toHaveBeenCalledWith('user-1', { locale: 'de', ui_language: 'en' });

    await i18next.changeLanguage('de');
    expect(client.setPersonProperties).toHaveBeenCalledExactlyOnceWith({ ui_language: 'de' });
});
