/**
 * TaskWorker — Worker BullMQ que delega ao TaskOrchestrator.
 *
 * Responsabilidade única: adaptar a interface do BullMQ para o TaskOrchestrator.
 * Toda a lógica de negócio vive no TaskOrchestrator — não aqui.
 *
 * Por que está em infrastructure/queue/?
 *   O worker é uma implementação de infraestrutura de fila (BullMQ).
 *   Pertence à mesma camada que BullMqTaskQueue — ambos são adaptadores
 *   da infraestrutura de mensageria, não lógica de aplicação.
 *
 * A conexão Redis e a Queue são importadas do container para evitar
 * duplicação de conexões (o container já cria uma instância de cada).
 */

import { Worker, Job } from 'bullmq';
import { logger } from '../../config/logger';
import { AgentTaskPayload } from '../../domain/shared/AgentTaskPayload';
import { TaskStatus } from '../../domain/task/value-objects/TaskStatus';
import { TaskOrchestrator } from '../../orchestration/TaskOrchestrator';
import { container, redisConnection } from '../../bootstrap/container';

const log = logger.child({ module: 'worker' });

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Reenfileira tarefas pendentes do banco de dados.
 *
 * Chamado na inicialização para recuperar tarefas interrompidas por restart.
 * Garante que nenhuma tarefa fique presa em estado inconsistente após uma
 * queda do servidor.
 *
 * Ordem de operações:
 *   1. Atualiza o status no banco ANTES de enfileirar (evita duplicatas)
 *   2. Enfileira via ITaskQueue (abstração, não BullMQ direto)
 */
export async function requeuePendingTasks(): Promise<void> {
    const taskRepo = container.taskRepo;
    const pending = await taskRepo.findByStatuses([
        TaskStatus.queued().value,
        TaskStatus.failed().value,
    ]);

    if (pending.length === 0) {
        log.info('Nenhuma tarefa pendente para reenfileirar.');
        return;
    }

    log.info({ count: pending.length }, 'Reenfileirando tarefas pendentes...');

    for (const task of pending) {
        try {
            if (task.status.isFailed()) {
                task.queue();
                await taskRepo.update(task);
            }

            await container.taskQueuePort.enqueue(
                {
                    taskId: task.id.value,
                    parentId: task.parentId.value,
                    parentTitle: '',
                    parentDescription: '',
                    repository: task.repository,
                    title: task.title || task.id.value,
                    description: task.description || '',
                    branch: task.branch.value,
                } satisfies AgentTaskPayload,
                { jobId: task.id.value, removeOnComplete: true, removeOnFail: false },
            );

            log.info({ taskId: task.id.value, was: task.status.value }, 'Tarefa reenfileirada');
        } catch (err) {
            log.error({ err, taskId: task.id.value }, 'Falha ao reenfileirar tarefa');
        }
    }

    log.info('Reenfileiramento de tarefas pendentes concluído.');
}

// ─── Worker ───────────────────────────────────────────────────────────────────

/**
 * Cria e retorna o worker BullMQ.
 *
 * Recebe o orquestrador como dependência para facilitar testes unitários —
 * em testes, basta passar um mock do TaskOrchestrator.
 *
 * Concorrência configurável via WORKER_CONCURRENCY (padrão: 3).
 */
export function createTaskWorker(orchestrator: TaskOrchestrator): Worker {
    return new Worker(
        'agent-tasks',
        async (job: Job<AgentTaskPayload>) => {
            const taskLog = log.child({ taskId: job.data.taskId, jobId: job.id });
            taskLog.info('Job recebido da fila');

            try {
                await orchestrator.processTask(job.data);
                taskLog.info('Job processado com sucesso');
            } catch (err) {
                taskLog.error({ err }, 'Job falhou');
                throw err; // BullMQ marca o job como failed e aplica retry policy
            }
        },
        {
            connection: redisConnection,
            concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10),
        },
    );
}
