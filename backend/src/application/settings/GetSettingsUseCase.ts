/**
 * GetSettingsUseCase — Retorna todas as configurações da aplicação.
 *
 * Responsabilidade única: ler o repositório de settings e devolver
 * o mapa chave/valor. Sem lógica de HTTP, sem conhecimento de Express.
 */

import { ISettingsRepository } from '../../domain/settings/ports/ISettingsRepository';

export class GetSettingsUseCase {
    constructor(private readonly settingsRepo: ISettingsRepository) { }

    async execute(): Promise<Record<string, string>> {
        return this.settingsRepo.findAll();
    }
}
