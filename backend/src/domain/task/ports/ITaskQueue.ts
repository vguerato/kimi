/**
 * ITaskQueue — Port para enfileiramento de tarefas do agente.
 *
 * Qualquer implementação de fila (BullMQ, SQS, RabbitMQ, etc.) deve
 * satisfazer este contrato. O domínio e a camada de aplicação dependem
 * apenas desta interface — nunca da implementação concreta.
 */

import { AgentTaskPayload } from '../../shared/AgentTaskPayload';

export interface EnqueueOptions {
    /** ID único do job — previne duplicatas na fila. */
    jobId?: string;
    /** Remove o job da fila após conclusão bem-sucedida. Padrão: true. */
    removeOnComplete?: boolean;
    /** Mantém o job na fila após falha para diagnóstico. Padrão: false. */
    removeOnFail?: boolean;
    /** Delay em ms antes de processar o job. */
    delay?: number;
}

export interface ITaskQueue {
    /** Enfileira uma nova tarefa para execução pelo agente. */
    enqueue(payload: AgentTaskPayload, options?: EnqueueOptions): Promise<void>;

    /** Retorna o estado atual de um job pelo ID, ou null se não encontrado. */
    getJobState(jobId: string): Promise<string | null>;

    /** Remove um job da fila pelo ID. */
    removeJob(jobId: string): Promise<void>;
}
