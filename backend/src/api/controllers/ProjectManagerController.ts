/**
 * ProjectManagerController — Endpoints agnósticos de gerenciamento de projetos.
 *
 * O provedor é determinado por:
 *   1. Parâmetro de rota `:provider` (ex: /project-manager/jira/webhook)
 *   2. Configuração `project_manager` nas settings (para rotas sem :provider)
 *
 * Tratamento de erros:
 *   Os use cases lançam HttpErrors diretamente (BadRequestError,
 *   ServiceUnavailableError, UnauthorizedError). O `asyncHandler` captura
 *   e o `errorHandler` global serializa com o status HTTP correto.
 *   O controller expressa apenas o caminho feliz.
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

  // ─── Provedor ativo ───────────────────────────────────────────────────────────

  /** GET /project-manager/config */
  async config(_req: Request, res: Response): Promise<void> {
    const config = await this.getPMConfig.execute();
    res.json(config);
  }

  /** GET /project-manager/mapping */
  async mapping(_req: Request, res: Response): Promise<void> {
    const mapping = await this.getMapping.execute();
    res.json({ mapping });
  }

  /** POST /project-manager/mapping */
  async saveMap(req: Request, res: Response): Promise<void> {
    const mapping = await this.saveMapping.execute(req.body as SaveMappingRequestDto);
    res.json({ success: true, mapping });
  }

  /** GET /project-manager/webhook */
  webhookHealth(_req: Request, res: Response): void {
    res.json({ status: 'ok', message: 'Webhook endpoint ativo.' });
  }

  /** POST /project-manager/webhook — usa o provedor ativo */
  async webhook(req: Request, res: Response): Promise<void> {
    await this.processWebhook.execute({
      body: req.body,
      signature: req.headers['x-hub-signature'] as string | undefined,
      rawBody: JSON.stringify(req.body),
    });
    res.json({ received: true });
  }

  // ─── Provedor específico (:provider) ─────────────────────────────────────────

  /** POST /project-manager/:provider/webhook */
  async providerWebhook(req: Request, res: Response): Promise<void> {
    await this.processWebhook.execute({
      body: req.body,
      signature: req.headers['x-hub-signature'] as string | undefined,
      rawBody: JSON.stringify(req.body),
      adapterType: String(req.params.provider),
    });
    res.json({ received: true });
  }

  /** GET /project-manager/:provider/config */
  async providerConfig(req: Request, res: Response): Promise<void> {
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
    const { webhookUrl, id } = await this.setupWebhook.execute({
      webhookUrl: req.body?.webhookUrl,
      providerType: String(req.params.provider),
    });
    res.json({ success: true, webhookUrl, id });
  }
}
