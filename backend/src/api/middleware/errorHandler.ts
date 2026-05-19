/**
 * errorHandler — Middleware global de tratamento de erros.
 *
 * Captura erros não tratados nos controllers e retorna uma resposta
 * JSON padronizada. Evita que stack traces vazem para o cliente em produção.
 *
 * Uso: registrar APÓS todas as rotas no Express.
 *   app.use(errorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

const log = logger.child({ module: 'error-handler' });

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const message = err instanceof Error ? err.message : String(err);

    log.error({ err, method: req.method, path: req.path }, 'Unhandled error in request');

    if (res.headersSent) return;

    res.status(500).json({ error: message });
}
