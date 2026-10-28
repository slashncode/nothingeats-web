// Confetti for the big moments (a level, a badge, a full stamp card, a wheel prize). Loaded on
// first use; nothing for people who prefer reduced motion, and never an error if it cannot draw.

export async function celebrate() {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        return;
    try {
        const { default: confetti } = await import('canvas-confetti');
        await confetti({
            particleCount: 140,
            spread: 75,
            origin: { y: 0.6 },
            disableForReducedMotion: true,
        });
    }
    catch {
        // No canvas (tests, very old browsers): the toast says it all.
    }
}
