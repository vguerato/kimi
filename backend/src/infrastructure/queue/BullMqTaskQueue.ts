/**
 * BullMqTaskQueue — Implementação de ITaskQueue via BullMQ.
 *
 * DIP: As camadas de domínio e aplicação dependem de ITaskQueue.
 *      Esta classe é o adapter concreto — registrado apenas no container.
 */

import { inject, injectable } from 'tsyringe';
import { Queue } from 'bullmq';
import { TOKENS } from '../../bootstrap/tokens';
import { ITaskQueue, EnqueueOptions } from '../../domain/task/ports/ITaskQueue';
import { AgentTaskPayload } from '../../domain/shared/AgentTaskPayload';

@injectable()
export class BullMqTaskQueue implements ITaskQueue {
    constructor(
        @inject(TOKENS.TaskQueue_Raw) private readonly queue: Queue,
    ) { }

    async enqueue(payload: AgentTaskPayload, options?: EnqueueOptions): Promise<void> {
        await this.queue.add('agent-task', payload, {
            jobId: options?.jobId ?? payload.taskId,
            removeOnComplete: options?.removeOnComplete ?? true,
            removeOnFail: options?.removeOnFail ?? false,
        });
    }

    async getJobState(jobId: string): Promise<string | null> {
        const job = await this.queue.getJob(jobId);
        if (!job) return null;
        return job.getState();
    }

    async removeJob(jobId: string): Promise<void> {
        const job = await this.queue.getJob(jobId);
        if (job) await job.remove();
    }

    getRawQueue(): Queue {
        return this.queue;
    }
}
