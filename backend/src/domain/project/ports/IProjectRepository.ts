/**
 * IProjectRepository — Port para persistência de projetos/repositórios.
 */

import { ProjectAggregate } from '../Project.aggregate';
import { ProjectId } from '../value-objects/ProjectId';

export interface IProjectRepository {
    save(project: ProjectAggregate): Promise<void>;
    update(project: ProjectAggregate): Promise<void>;
    findById(id: ProjectId): Promise<ProjectAggregate | null>;
    findByPrefix(prefix: string): Promise<ProjectAggregate | null>;
    findAll(): Promise<ProjectAggregate[]>;
    deleteById(id: ProjectId): Promise<void>;
}
