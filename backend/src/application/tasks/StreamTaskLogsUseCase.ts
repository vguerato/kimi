/**
 * StreamTaskLogsUseCase — Fornece logs de uma tarefa para streaming SSE.
 *
 * Dois modos de operação:
 *
 *   1. Tarefa em andamento: retorna o buffer atual e registra listener
 *      para novos logs em tempo real via EventEmitter.
 *
 *   2. Tarefa concluída (sem buffer ativo): lê os logs persistidos no banco
 *      e retorna como histórico estático (sem listener).
 *
 * O controller é responsável por gerenciar o ciclo de vida da conexão SSE.
 * Este use case apenas fornece os dados e o mecanismo de subscrição.
 */

import { ITaskRepository } from '../../domain/task/ports/ITaskRepository';
import { TaskId } from '../../domain/task/value-objects/TaskId';
import { SSELogger, LogEntry } from '../../infrastructure/logging/SSELogger';

export interface LogHistoryResult {
    type: 'history';
    entries: LogEntry[];
    /** Presente quando a tarefa já está concluída e não há stream ativo. */
    finalStatus?: string;
}

export interface LogStreamResult {
    type: 'stream';
    /** Entradas já no buffer (histórico parcial). */
    bufferedEntries: LogEntry[];
    /** Nome do evento SSE para subscrever novos logs. */
    eventName: string;
}

export type StreamTaskLogsResult = LogHistoryResult | LogStreamResult;

export class StreamTaskLogsUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly sseLogger: SSELogger,
    ) { }

    async execute(taskId: string): Promise<StreamTaskLogsResult> {
        const buffer = this.sseLogger.getBuffer(taskId);

        // Há buffer ativo → tarefa em andamento, retorna stream
        if (buffer.length > 0) {
            return {
                type: 'stream',
                bufferedEntries: buffer,
                eventName: `log:${taskId}`,
            };
        }

        // Sem buffer → tenta carregar logs persistidos do banco
        try {
            const task = await this.taskRepo.findById(TaskId.create(taskId));
            if (task?.logs) {
                const entries = task.logs.split('\n').filter(Boolean).map(line => {
                    const m = line.match(/^\[(.+?)\] \[(.+?)\] (.*)$/);
                    return m
                        ? { ts: m[1], level: m[2] as LogEntry['level'], message: m[3] }
                        : { ts: new Date().toISOString(), level: 'info' as LogEntry['level'], message: line };
                });

                return {
                    type: 'history',
                    entries,
                    finalStatus: task.status.value,
                };
            }
        } catch { /* tarefa pode não existir ainda */ }

        // Nenhum log disponível → retorna stream vazio (aguarda logs futuros)
        return {
            type: 'stream',
            bufferedEntries: [],
            eventName: `log:${taskId}`,
        };
    }
}
