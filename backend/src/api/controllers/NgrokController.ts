/**
 * NgrokController — Endpoint de informações do tunnel Ngrok.
 *
 * Rota:
 *   GET /ngrok-url → retorna a URL pública atual e a URL de webhook derivada
 *
 * O estado da URL é gerenciado pelo NgrokService (infrastructure/tunnel/)
 * e compartilhado via shared/ngrok-state.ts. O controller apenas lê
 * esse estado — sem acoplamento direto ao Ngrok.
 */

import { Request, Response } from 'express';
import { getNgrokUrl } from '../../shared/ngrok-state';

export class NgrokController {
  /** GET /ngrok-url */
  getUrl(_req: Request, res: Response): void {
    const url = getNgrokUrl();
    res.json({
      url: url ?? null,
      webhookUrl: url ? `${url}/api/webhook` : null,
    });
  }
}
