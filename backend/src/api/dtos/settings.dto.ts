/**
 * DTOs de Settings — contratos de entrada e saída da API de configurações.
 */

/** Corpo da requisição POST /settings. */
export type SaveSettingsRequestDto = Record<string, unknown>;

/** Resposta do POST /settings. */
export interface SaveSettingsResponseDto {
    success: true;
    /** true = credenciais PM válidas, false = inválidas, null = não foram fornecidas */
    pmValid: boolean | null;
    /** true = PAT Git válido, false = inválido, null = não foi fornecido */
    gitValid: boolean | null;
    /** Login do usuário GitHub autenticado */
    gitLogin?: string;
}
