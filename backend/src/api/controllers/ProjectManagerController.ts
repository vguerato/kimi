/**
 * ProjectManagerController — Endpoints agnósticos de gerenciamento de projetos.
 *
 * Todas as operações são agnósticas de provedor. O provedor é determinado por:
 *   1. Parâmetro de rota `:provider` (ex: /project-manager/jira/webhook)
 *   2. Configuração `project_manager` nas settings (para rotas sem :provider)
 *
 * Rotas:
 *   GET  /project-manager/providers              → lista provedores disponíveis
 *   GET  /project-manager/config                 → config do PM ativo
 *   GET  /project-manager/mapping                → mapeamento do PM ativo
 *   POST /project-manager/mapping                → salva mapeamento
 *   GET  /project-manager/webhook                → health check
 *   POST /project-manager/webhook                → processa webhook (PM ativo)
 *
 *   GET  /project-manager/:provider/webhook      → health check
 *   POST /project-manager/:provider/webhook      → processa webhook do provedor
 *   GET  /project-manager/:provider/config       → config do provedor
 *   GET  /project-manager/:provider/mapping      → mapeamento do provedor
 *   POST /project-manager/:provider/mapping      → salva mapeamento do provedor
 *   POST /project-manager/:provider/setup-webhook → registra webhook no provedor
 */

import { Request, Response } from 'express';
import { GetProvidersUseCase } from '../../application/project-manager/GetProvidersUseCase';
import { GetPMConfigUseCase } from '../../application/project-manager/GetPMConfigUseCase';
import { GetMappingUseCase } from '../../application/project-manager/GetMappingUseCase';
import { SaveMappingUseCase } from '../../application/project-manager/SaveMappingUseCase';
import { ProcessWebhookUseCase } from '../../application/project-manager/ProcessWebhookUseCase';
import { SetupWebhookUseCase } from '../../application/project-manager/SetupWebhookUseCase';
import { SaveMappingRequestDto } from '../dtos/project-manager.dto';

export class ProjectManagerController {
    constructor(
        private readonly getProviders: GetProvidersUseCase,
        private readonly getPMConfig: GetPMConfigUseCase,
        private readonly getMapping: GetMappingUseCase,
        private readonly saveMapping: SaveMappingUseCase,
        private readonly processWebhook: ProcessWebhookUseCase,
        private readonly setupWebhook: SetupWebhookUseCase,
    ) { }

    // ─── Metadados ───────────────────────────────────────────────────────────────

    /** GET /project-manager/providers */
    providers(_req: Request, res: Response): void {
        res.json(this.getProviders.execute());
    }

    // ─── Provedor ativo (sem :provider na rota) ──────────────────────────────────

    /** GET /project-manager/config */
    async config(_req: Request, res: Response): Promise<void> {
        const result = await this.getPMConfig.execute();
        if (result.type === 'no_adapter') {
            res.status(503).json({ error: 'Nenhum adapter de project manager registrado.' });
            return;
        }
        res.json(result.config);
    }

    /** GET /project-manager/mapping */
    async mapping(_req: Request, res: Response): Promise<void> {
        const result = await this.getMapping.execute();
        if (result.type === 'no_adapter') {
            res.status(503).json({ error: 'Nenhum adapter de project manager registrado.' });
            return;
        }
        res.json({ mapping: result.mapping });
    }

    /** POST /project-manager/mapping */
    async saveMap(req: Request, res: Response): Promise<void> {
        const body = req.body as SaveMappingRequestDto;
        const result = await this.saveMapping.execute(body);
        this.handleSaveMappingResult(result, res);
    }

    /** GET /project-manager/webhook */
    webhookHealth(_req: Request, res: Response): void {
        res.json({ status: 'ok', message: 'Webhook endpoint ativo.' });
    }

    /** POST /project-manager/webhook — usa o provedor ativo */
    async webhook(req: Request, res: Response): Promise<void> {
        const result = await this.processWebhook.execute({
            body: req.body,
            signature: req.headers['x-hub-signature'] as string | undefined,
            rawBody: JSON.stringify(req.body),
        });
        this.handleWebhookResult(result, res);
    }

    // ─── Provedor específico (:provider na rota) ─────────────────────────────────

    /** POST /project-manager/:provider/webhook */
    async providerWebhook(req: Request, res: Response): Promise<void> {
        const provider = String(req.params.provider);
        const result = await this.processWebhook.execute({
            body: req.body,
            signature: req.headers['x-hub-signature'] as string | undefined,
            rawBody: JSON.stringify(req.body),
            adapterType: provider,
        });
        this.handleWebhookResult(result, res);
    }

    /** GET /project-manager/:provider/config */
    async providerConfig(req: Request, res: Response): Promise<void> {
        // Reutiliza o use case — o provedor ativo é determinado pelas settings
        // Para suporte multi-provedor, o GetPMConfigUseCase pode ser estendido
        // para aceitar um tipo explícito.
        await this.config(req, res);
    }

    /** GET /project-manager/:provider/mapping */
    async providerMapping(req: Request, res: Response): Promise<void> {
        await this.mapping(req, res);
    }

    /** POST /project-manager/:provider/mapping */
    async saveProviderMapping(req: Request, res: Response): Promise<void> {
        await this.saveMap(req, res);
    }

    /** POST /project-manager/:provider/setup-webhook */
    async providerSetupWebhook(req: Request, res: Response): Promise<void> {
        const result = await this.setupWebhook.execute({ webhookUrl: req.body?.webhookUrl });

        switch (result.type) {
            case 'ok':
                res.json({ success: true, webhookUrl: result.webhookUrl, id: result.id });
                break;
            case 'no_adapter':
                res.status(503).json({ error: `Adapter "${req.params.provider}" não registrado.` });
                break;
            case 'no_url':
                res.status(400).json({
                    success: false,
                    error: 'Tunnel Ngrok não está ativo. Configure NGROK_AUTHTOKEN ou forneça webhookUrl.',
                });
                break;
            case 'error':
                res.status(400).json({ success: false, error: result.message });
                break;
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private handleWebhookResult(
        result: Awaited<ReturnType<ProcessWebhookUseCase['execute']>>,
        res: Response,
    ): void {
        switch (result.type) {
            case 'ok':
                res.json({ received: true });
                break;
            case 'no_adapter':
                res.status(503).json({ error: 'Nenhum adapter de project manager registrado.' });
                break;
            case 'unauthorized':
                res.status(401).json({ error: result.message });
                break;
        }
    }

    private handleSaveMappingResult(
        result: Awaited<ReturnType<SaveMappingUseCase['execute']>>,
        res: Response,
    ): void {
        switch (result.type) {
            case 'ok':
                res.json({ success: true, mapping: result.mapping });
                break;
            case 'no_adapter':
                res.status(503).json({ error: 'Nenhum adapter de project manager registrado.' });
                break;
            case 'invalid_input':
                res.status(400).json({ success: false, error: result.message });
                break;
        }
    }
}
