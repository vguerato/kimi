/**
 * HealthController — Endpoint de health check da aplicação.
 *
 * Rota:
 *   GET /health → retorna status, timestamp e versão
 *
 * Usado por orquestradores (Docker, Kubernetes, load balancers) para
 * verificar se o servidor está respondendo corretamente.
 */

import { Request, Response } from 'express';

export class HealthController {
    /** GET /health */
    async check(_req: Request, res: Response): Promise<void> {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version ?? '2.0.0',
        });
    }
}
