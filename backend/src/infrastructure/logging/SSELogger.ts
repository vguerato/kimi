/**
 * SSELogger — Logger de eventos em tempo real para Server-Sent Events.
 *
 * Responsabilidades:
 *   - Manter um buffer circular de entradas de log por taskId
 *   - Emitir eventos para clientes SSE conectados em tempo real
 *   - Formatar o buffer como string para persistência no banco
 *
 * Arquitetura:
 *   SSELogger é um EventEmitter. Clientes SSE se inscrevem no evento
 *   `log:{taskId}` e recebem cada LogEntry conforme é produzida.
 *   O buffer permite que clientes que se conectam tarde recebam o histórico.
 *
 * Limites:
 *   - Máximo de 500 entradas por task (circular buffer)
 *   - Buffer é limpo após a task ser concluída (clearBuffer)
 */

import { EventEmitter } from 'events';

export type LogLevel = 'info' | 'tool' | 'error' | 'system' | 'warn';

export interface LogEntry {
    ts: string;
    level: LogLevel;
    message: string;
}

const MAX_BUFFER_SIZE = 500;

export class SSELogger extends EventEmitter {
    private readonly buffers = new Map<string, LogEntry[]>();

    /**
     * Registra uma entrada de log para uma task.
     * Armazena no buffer circular e notifica listeners SSE imediatamente.
     */
    log(taskId: string, level: LogLevel, message: string): void {
        const entry: LogEntry = { ts: new Date().toISOString(), level, message };

        if (!this.buffers.has(taskId)) {
            this.buffers.set(taskId, []);
        }

        const buffer = this.buffers.get(taskId)!;
        buffer.push(entry);

        // Descarta entradas antigas quando o buffer está cheio
        if (buffer.length > MAX_BUFFER_SIZE) {
            buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
        }

        this.emit(`log:${taskId}`, entry);
    }

    /** Retorna todas as entradas de log de uma task (histórico). */
    getBuffer(taskId: string): LogEntry[] {
        return this.buffers.get(taskId) ?? [];
    }

    /** Remove o buffer de uma task. Chamado após conclusão para liberar memória. */
    clearBuffer(taskId: string): void {
        this.buffers.delete(taskId);
    }

    /**
     * Serializa o buffer como string de log para persistência no banco.
     * Formato: `[ISO_TIMESTAMP] [LEVEL] MESSAGE\n`
     */
    formatBufferAsString(taskId: string): string {
        return this.getBuffer(taskId)
            .map(e => `[${e.ts}] [${e.level}] ${e.message}`)
            .join('\n');
    }
}

/** Singleton — compartilhado entre worker, orquestrador e rotas SSE. */
export const logEmitter = new SSELogger();
