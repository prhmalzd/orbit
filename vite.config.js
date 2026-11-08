import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['orbit-mark.svg'],
            manifest: {
                name: 'Orbit — Visual Project Workspace',
                short_name: 'Orbit',
                description: 'A private, offline visual workspace for all the projects in your head.',
                theme_color: '#11100f',
                background_color: '#11100f',
                display: 'standalone',
                start_url: '/',
                icons: [
                    { src: '/orbit-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,woff2}']
            }
        })
    ]
});
