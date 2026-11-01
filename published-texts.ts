import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Publishes the default texts with the build as `/locales/<namespace>.<language>.json`: `web` (the
 * app's i18next resources) and `ui` (nothingeats-ui's strings). The backoffice reads them to know
 * every key and its default wording (journal record 042).
 */
export function publishedTexts(root: string): Plugin {
    return {
        name: 'nothingeats-published-texts',
        apply: 'build',
        async generateBundle() {
            const { UI_STRINGS } = await import('@slashncode/nothingeats-ui/strings');
            for (const language of ['de', 'en'] as const) {
                this.emitFile({
                    type: 'asset',
                    fileName: `locales/web.${language}.json`,
                    source: readFileSync(path.join(root, 'src/i18n/locales', `${language}.json`), 'utf8'),
                });
                this.emitFile({
                    type: 'asset',
                    fileName: `locales/ui.${language}.json`,
                    source: `${JSON.stringify(UI_STRINGS[language], null, 2)}\n`,
                });
            }
        },
    };
}
