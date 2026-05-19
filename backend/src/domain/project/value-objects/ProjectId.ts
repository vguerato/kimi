/**
 * ProjectId — Value object para identificador de projeto.
 */
export class ProjectId {
    private constructor(readonly value: string) { }

    static create(raw: string): ProjectId {
        const trimmed = raw?.trim();
        if (!trimmed) throw new Error('ProjectId cannot be empty');
        return new ProjectId(trimmed);
    }

    /** Cria um ProjectId a partir do prefixo do repositório (ex: "fin"). */
    static fromPrefix(prefix: string): ProjectId {
        return ProjectId.create(prefix.toLowerCase().trim());
    }

    equals(other: ProjectId): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
