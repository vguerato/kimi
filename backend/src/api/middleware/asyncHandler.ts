/**
 * asyncHandler — Wrapper para controllers assíncronos.
 *
 * Captura erros de Promises e os encaminha para o errorHandler global,
 * eliminando a necessidade de try/catch em cada controller.
 *
 * Uso:
 *   router.get('/path', asyncHandler(controller.method.bind(controller)));
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
