import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    mainSidebar: [
        {
            type: 'doc',
            id: 'index',
            label: 'Início',
        },
        {
            type: 'category',
            label: 'Guias',
            collapsed: false,
            items: [
                'guides/getting-started',
                'guides/task-flow',
            ],
        },
        {
            type: 'category',
            label: 'Arquitetura',
            collapsed: false,
            items: [
                'architecture/overview',
                'architecture/components',
            ],
        },
        {
            type: 'category',
            label: 'Integrações',
            collapsed: false,
            items: [
                'integrations/jira',
                'integrations/azure-devops',
                'integrations/llm-providers',
                'integrations/vcs',
            ],
        },
        {
            type: 'category',
            label: 'Referência',
            collapsed: false,
            items: [
                'reference/api',
                'reference/configuration',
            ],
        },
    ],
};

export default sidebars;
