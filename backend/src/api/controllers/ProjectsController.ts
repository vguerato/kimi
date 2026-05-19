/**
 * ProjectsController — Endpoints de projetos/repositórios.
 *
 * Rotas:
 *   GET    /repos/status              → status de indexação por repositório
 *   GET    /projects                  → lista projetos com metadados de contexto
 *   POST   /projects/:prefix/index    → dispara indexação de contexto
 *   GET    /projects/:prefix/context  → retorna contexto indexado
 *   DELETE /projects/:prefix/memory   → limpa memória do projeto
 */

import { Request, Response } from 'express';
import { ListProjectsUseCase } from '../../application/projects/ListProjectsUseCase';
import { GetRepoStatusUseCase } from '../../application/projects/GetRepoStatusUseCase';
import { IndexProjectUseCase } from '../../application/projects/IndexProjectUseCase';
import { GetProjectContextUseCase } from '../../application/projects/GetProjectContextUseCase';
import { ClearProjectMemoryUseCase } from '../../application/projects/ClearProjectMemoryUseCase';

export class ProjectsController {
    constructor(
        private readonly listProjects: ListProjectsUseCase,
        private readonly getRepoStatus: GetRepoStatusUseCase,
        private readonly indexProject: IndexProjectUseCase,
        private readonly getProjectContext: GetProjectContextUseCase,
        private readonly clearProjectMemory: ClearProjectMemoryUseCase,
    ) { }

    /** GET /repos/status */
    async repoStatus(_req: Request, res: Response): Promise<void> {
        const statusMap = await this.getRepoStatus.execute();
        res.json(statusMap);
    }

    /** GET /projects */
    async list(_req: Request, res: Response): Promise<void> {
        const projects = await this.listProjects.execute();
        res.json(projects);
    }

    /** POST /projects/:prefix/index */
    async index(req: Request, res: Response): Promise<void> {
        const prefix = String(req.params.prefix);
        const result = await this.indexProject.execute({ prefix });

        if (result.type === 'not_found') {
            res.status(404).json({ error: `Repositório "${prefix}" não encontrado.` });
            return;
        }

        res.json({ success: true, message: `Indexação do projeto "${prefix}" iniciada.` });
    }

    /** GET /projects/:prefix/context */
    async getContext(req: Request, res: Response): Promise<void> {
        const prefix = String(req.params.prefix);
        const result = await this.getProjectContext.execute(prefix);

        if (result.type === 'not_found') {
            res.status(404).json({
                error: `Contexto do projeto "${prefix}" não encontrado. Execute POST /projects/${prefix}/index primeiro.`,
            });
            return;
        }

        res.json(result.context);
    }

    /** DELETE /projects/:prefix/memory */
    async clearMemory(req: Request, res: Response): Promise<void> {
        const prefix = String(req.params.prefix);
        await this.clearProjectMemory.execute(prefix);
        res.json({ success: true, message: `Memória do projeto "${prefix}" limpa.` });
    }
}
