import process from 'node:process';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API lives behind the same gateway in every environment. Locally, Vite forwards /api to the
// k3d cluster, so cookies (refresh token) and paths behave exactly like in production.
const gateway = process.env.NOTHINGEATS_GATEWAY ?? 'http://nothingeats.localhost';

export default defineConfig({
    plugins: [
        tanstackRouter({ target: 'react', autoCodeSplitting: true }),
        react(),
    ],
    optimizeDeps: {
        // nothingeats-ui imports MapLibre's worker with `?url`, which only Vite's own pipeline
        // resolves; the dependency pre-bundler cannot. Served as is, its imports still go through it.
        exclude: ['@slashncode/nothingeats-ui'],
    },
    server: {
        port: 5173,
        proxy: {
            '/api': { target: gateway, changeOrigin: true },
        },
    },
    build: {
        sourcemap: true,
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['src/test/setup.ts'],
        css: {
            modules: { classNameStrategy: 'non-scoped' },
        },
        // nothingeats-ui imports its fonts' CSS; Vite has to transform it, Node cannot import CSS.
        server: {
            deps: {
                inline: ['@slashncode/nothingeats-ui', /@fontsource/],
            },
        },
    },
});
