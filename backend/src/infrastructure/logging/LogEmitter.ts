/**
 * LogEmitter — Re-exporta SSELogger para compatibilidade de imports.
 *
 * O módulo foi renomeado para SSELogger para refletir melhor sua função.
 * Este arquivo mantém os imports existentes funcionando sem alteração.
 */
export { SSELogger, logEmitter } from './SSELogger';
export type { LogEntry, LogLevel } from './SSELogger';
