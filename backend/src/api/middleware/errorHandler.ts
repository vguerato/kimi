/**
 * errorHandler — Middleware global de tratamento de erros.
 *
 * Captura erros não tratados nos controllers e retorna uma resposta
 * JSON padronizada. Evita que stack traces vazem para o cliente em produção.
 *
 * Reconhece instâncias de HttpError (definidas em api/errors/HttpError.ts)
 * e usa o statusCode correspondente. Qualquer outro erro retorna 500.
 *
 * Uso: registrar APÓS todas as rotas no Express.
 *   app.use(errorHandler);
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';
import { HttpError } from '../errors/HttpError';

const log = logger.child({ module: 'error-handler' });

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    if (res.headersSent) return;

    if (err instanceof HttpError) {
        // Erros esperados (4xx) — log em warn, não em error
        log.warn({ statusCode: err.statusCode, method: req.method, path: req.path }, err.message);
        res.status(err.statusCode).json({ error: err.message });
        return;
    }

    // Erros inesperados (5xx) — log completo com stack
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err, method: req.method, path: req.path }, 'Unhandled error in request');
    res.status(500).json({ error: message });
}
