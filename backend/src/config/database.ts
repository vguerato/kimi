/**
 * TypeORM DataSource — SQLite via better-sqlite3.
 *
 * Entidades são auto-descobertas. Em desenvolvimento, `synchronize: true`
 * cria/migra tabelas automaticamente. Em produção, use migrations explícitas.
 */

import 'reflect-metadata';
import path from 'path';
import fs from 'fs';
import { DataSource } from 'typeorm';
import { Setting } from '../infrastructure/persistence/entities/Setting';
import { Task } from '../infrastructure/persistence/entities/Task';
import { logger } from './logger';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: path.join(dataDir, 'database.sqlite'),
  entities: [Setting, Task],
  synchronize: true,
  logging: false,
});

/** Inicializa a conexão. Chamado uma vez no bootstrap do servidor. */
export async function dbInit(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    logger.info('TypeORM DataSource inicializado (SQLite).');
  }
}
