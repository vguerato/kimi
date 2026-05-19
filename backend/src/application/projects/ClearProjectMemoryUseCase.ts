/**
 * ClearProjectMemoryUseCase — Remove toda a memória de um projeto.
 * Inclui contexto indexado e histórico de execuções.
 */

import { IMemoryPort } from '../../domain/agent/ports/IMemoryPort';

export class ClearProjectMemoryUseCase {
    constructor(private readonly memory: IMemoryPort) { }

    async execute(prefix: string): Promise<void> {
        await this.memory.clearProjectMemory(prefix);
    }
}
