import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'Shift',
    tagline: 'Automação de tarefas de desenvolvimento orientada por agentes de IA',
    favicon: 'img/favicon.ico',

    url: 'http://localhost',
    baseUrl: '/',

    onBrokenLinks: 'warn',
    onBrokenMarkdownLinks: 'warn',

    i18n: {
        defaultLocale: 'pt',
        locales: ['pt'],
    },

    presets: [
        [
            'classic',
            {
                docs: {
                    routeBasePath: '/',
                    sidebarPath: './sidebars.ts',
                    editUrl: undefined,
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],

    themeConfig: {
        colorMode: {
            defaultMode: 'dark',
            disableSwitch: false,
            respectPrefersColorScheme: true,
        },
        navbar: {
            title: 'Shift',
            logo: {
                alt: 'Shift',
                src: 'img/logo.svg',
            },
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'mainSidebar',
                    position: 'left',
                    label: 'Documentação',
                },
                {
                    href: 'http://localhost:5173',
                    label: 'Dashboard',
                    position: 'right',
                },
                {
                    href: 'http://localhost:3001/health',
                    label: 'API',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            copyright: `Shift — Documentação`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['bash', 'typescript', 'json', 'yaml', 'docker'],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
