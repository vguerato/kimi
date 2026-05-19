/**
 * index.ts — Entry point do servidor Kiro AI Backend v2.
 *
 * Responsabilidade única: carregar variáveis de ambiente e delegar
 * toda a inicialização para bootstrap/app.ts.
 *
 * Por que tão simples?
 *   - Facilita testes de integração (importar app.ts sem iniciar o servidor)
 *   - A sequência de bootstrap está documentada em um único lugar (app.ts)
 *   - Erros fatais são capturados aqui e encerram o processo com código 1
 */

import 'reflect-metadata';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import { startApp } from './bootstrap/app';

dotenv.config();

startApp().catch((err) => {
  logger.fatal({ err }, 'Falha ao iniciar servidor');
  process.exit(1);
});
