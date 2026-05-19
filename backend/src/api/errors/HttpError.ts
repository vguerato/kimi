/**
 * HttpError — Hierarquia de erros HTTP para uso nos controllers.
 *
 * Por que exceções em vez de Result types no controller?
 *   Os use cases retornam Result types (discriminated unions) porque são
 *   agnósticos de HTTP — não sabem o que é um status 503 ou 400.
 *   Os controllers traduzem esses resultados para HTTP. Quando o resultado
 *   indica um erro, lançar uma HttpError é mais limpo do que um switch
 *   repetido em cada método: o `asyncHandler` captura e o `errorHandler`
 *   serializa automaticamente.
 *
 * Uso nos controllers:
 *   if (result.type === 'no_adapter') throw new ServiceUnavailableError('...');
 *   if (result.type === 'invalid_input') throw new BadRequestError(result.message);
 *
 * O `errorHandler` global detecta instâncias de HttpError e usa o statusCode
 * correto em vez de sempre retornar 500.
 */

/** Erro HTTP base — carrega o status code junto com a mensagem. */
export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = this.constructor.name;
        // Mantém o prototype correto para instanceof funcionar com transpilação
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/** 400 Bad Request — entrada inválida do cliente. */
export class BadRequestError extends HttpError {
    constructor(message: string) {
        super(400, message);
    }
}

/** 401 Unauthorized — credenciais ausentes ou inválidas. */
export class UnauthorizedError extends HttpError {
    constructor(message = 'Não autorizado.') {
        super(401, message);
    }
}

/** 404 Not Found — recurso não encontrado. */
export class NotFoundError extends HttpError {
    constructor(message: string) {
        super(404, message);
    }
}

/** 409 Conflict — estado incompatível com a operação solicitada. */
export class ConflictError extends HttpError {
    constructor(message: string) {
        super(409, message);
    }
}

/** 503 Service Unavailable — dependência não registrada ou indisponível. */
export class ServiceUnavailableError extends HttpError {
    constructor(message: string) {
        super(503, message);
    }
}
