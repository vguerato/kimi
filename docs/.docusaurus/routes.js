import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/', '591'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/', '423'),
        routes: [
          {
            path: '/',
            component: ComponentCreator('/', '176'),
            routes: [
              {
                path: '/architecture/components',
                component: ComponentCreator('/architecture/components', '1f7'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/architecture/overview',
                component: ComponentCreator('/architecture/overview', 'fd5'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/guides/getting-started',
                component: ComponentCreator('/guides/getting-started', '497'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/guides/task-flow',
                component: ComponentCreator('/guides/task-flow', 'd82'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/integrations/azure-devops',
                component: ComponentCreator('/integrations/azure-devops', '023'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/integrations/jira',
                component: ComponentCreator('/integrations/jira', '60e'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/integrations/llm-providers',
                component: ComponentCreator('/integrations/llm-providers', '2f7'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/integrations/vcs',
                component: ComponentCreator('/integrations/vcs', '83f'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/reference/api',
                component: ComponentCreator('/reference/api', 'ae4'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/reference/configuration',
                component: ComponentCreator('/reference/configuration', '8a0'),
                exact: true,
                sidebar: "mainSidebar"
              },
              {
                path: '/',
                component: ComponentCreator('/', 'c02'),
                exact: true,
                sidebar: "mainSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
