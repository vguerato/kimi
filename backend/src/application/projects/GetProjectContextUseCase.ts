/**
 * GetProjectContextUseCase — Retorna o contexto indexado de um projeto.
 */

import { IMemoryPort, ProjectContextMemory } from '../../domain/agent/ports/IMemoryPort';

export type GetProjectContextResult =
    | { type: 'found'; context: ProjectContextMemory }
    | { type: 'not_found' };

export class GetProjectContextUseCase {
    constructor(private readonly memory: IMemoryPort) { }

    async execute(prefix: string): Promise<GetProjectContextResult> {
        const context = await this.memory.getProjectContext(prefix);
        if (!context) return { type: 'not_found' };
        return { type: 'found', context };
    }
}
