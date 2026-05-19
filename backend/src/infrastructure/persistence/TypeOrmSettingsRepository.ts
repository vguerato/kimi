/**
 * TypeOrmSettingsRepository — Implementação de ISettingsRepository via TypeORM.
 *
 * Persiste configurações como pares chave/valor na tabela `settings`.
 * Operações de upsert são atômicas — sem race conditions em atualizações concorrentes.
 */

import { inject, injectable } from 'tsyringe';
import { DataSource } from 'typeorm';
import { TOKENS } from '../../bootstrap/tokens';
import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';
import { Setting } from './entities/Setting';

@injectable()
export class TypeOrmSettingsRepository implements ISettingsRepository {
    constructor(
        @inject(TOKENS.DataSource) private readonly dataSource: DataSource,
    ) { }

    async findAll(): Promise<Record<string, string>> {
        const repo = this.dataSource.getRepository(Setting);
        const rows = await repo.find();
        return Object.fromEntries(rows.map(r => [r.key, r.value]));
    }

    async findOne(key: string): Promise<string | null> {
        const repo = this.dataSource.getRepository(Setting);
        const row = await repo.findOneBy({ key });
        return row?.value ?? null;
    }

    async upsert(key: string, value: string): Promise<void> {
        const repo = this.dataSource.getRepository(Setting);
        await repo.upsert(
            Object.assign(new Setting(), { key, value: String(value) }),
            ['key'],
        );
    }

    async upsertMany(entries: Record<string, string>): Promise<void> {
        const repo = this.dataSource.getRepository(Setting);
        await Promise.all(
            Object.entries(entries).map(([key, value]) =>
                repo.upsert(
                    Object.assign(new Setting(), { key, value: String(value) }),
                    ['key'],
                ),
            ),
        );
    }
}
