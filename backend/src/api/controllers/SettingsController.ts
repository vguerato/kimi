/**
 * SettingsController — Endpoints de configuração da aplicação.
 *
 * Responsabilidades:
 *   - Extrair dados da requisição HTTP
 *   - Delegar ao use case correspondente
 *   - Serializar a resposta HTTP
 *
 * Sem lógica de negócio — toda a orquestração está nos use cases.
 */

import { Request, Response } from 'express';
import { GetSettingsUseCase } from '../../application/settings/GetSettingsUseCase';
import { SaveSettingsUseCase } from '../../application/settings/SaveSettingsUseCase';

export class SettingsController {
    constructor(
        private readonly getSettings: GetSettingsUseCase,
        private readonly saveSettings: SaveSettingsUseCase,
    ) { }

    /** GET /settings */
    async get(_req: Request, res: Response): Promise<void> {
        const settings = await this.getSettings.execute();
        res.json(settings);
    }

    /** POST /settings */
    async save(req: Request, res: Response): Promise<void> {
        const result = await this.saveSettings.execute({ settings: req.body });
        res.json({ success: true, pmValid: result.pmValid });
    }
}
