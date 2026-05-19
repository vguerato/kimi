import { heroui } from '@heroui/theme';

export default heroui({
    defaultTheme: 'dark',
    defaultExtendTheme: 'dark',
    themes: {
        dark: {
            extend: 'dark',
            colors: {
                // Base surfaces
                background: '#0d0d10',
                foreground: '#f4f4f5',
                divider: '#1e1e2e',
                overlay: 'rgba(0,0,0,0.75)',
                focus: '#6366f1',

                // Content layers (cards, panels, inputs)
                content1: '#13131a',   // cards / panels
                content2: '#1a1a2e',   // inputs / elevated rows
                content3: '#2a2a3e',   // borders / dividers
                content4: '#3a3a5e',   // hover borders

                // Semantic colors
                default: {
                    DEFAULT: '#2a2a3e',
                    foreground: '#9ca3af',
                    50: '#1a1a2e',
                    100: '#1e1e2e',
                    200: '#2a2a3e',
                    300: '#3a3a5e',
                    400: '#6b7280',
                    500: '#9ca3af',
                    600: '#d1d5db',
                    700: '#e5e7eb',
                    800: '#f3f4f6',
                    900: '#f9fafb',
                },
                primary: {
                    DEFAULT: '#6366f1',
                    foreground: '#ffffff',
                    50: 'rgba(99,102,241,0.08)',
                    100: 'rgba(99,102,241,0.12)',
                    200: 'rgba(99,102,241,0.20)',
                    300: 'rgba(99,102,241,0.30)',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                },
                secondary: {
                    DEFAULT: '#8b5cf6',
                    foreground: '#ffffff',
                    50: 'rgba(139,92,246,0.08)',
                    100: 'rgba(139,92,246,0.12)',
                    200: 'rgba(139,92,246,0.20)',
                    300: 'rgba(139,92,246,0.30)',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                },
                success: {
                    DEFAULT: '#22c55e',
                    foreground: '#ffffff',
                    50: 'rgba(34,197,94,0.08)',
                    100: 'rgba(34,197,94,0.12)',
                    200: 'rgba(34,197,94,0.20)',
                    300: 'rgba(34,197,94,0.30)',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d',
                },
                warning: {
                    DEFAULT: '#eab308',
                    foreground: '#000000',
                    50: 'rgba(234,179,8,0.08)',
                    100: 'rgba(234,179,8,0.12)',
                    200: 'rgba(234,179,8,0.20)',
                    300: 'rgba(234,179,8,0.30)',
                    400: '#facc15',
                    500: '#eab308',
                    600: '#ca8a04',
                    700: '#a16207',
                    800: '#854d0e',
                    900: '#713f12',
                },
                danger: {
                    DEFAULT: '#ef4444',
                    foreground: '#ffffff',
                    50: 'rgba(239,68,68,0.08)',
                    100: 'rgba(239,68,68,0.12)',
                    200: 'rgba(239,68,68,0.20)',
                    300: 'rgba(239,68,68,0.30)',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                },
            },
        },
    },
});
