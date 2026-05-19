/**
 * BranchName — Value object for a Git branch name.
 *
 * Enforces naming conventions and provides factory methods
 * for the two common creation patterns.
 */
export class BranchName {
    private constructor(readonly value: string) { }

    /**
     * Creates a branch name from a raw string, sanitising it to be
     * a valid Git ref (lowercase, hyphens, no special chars).
     */
    static fromRaw(raw: string): BranchName {
        const sanitised = raw
            .toLowerCase()
            .replace(/[^a-z0-9/_-]/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');

        if (!sanitised) throw new Error(`Cannot create BranchName from: "${raw}"`);
        return new BranchName(sanitised);
    }

    /**
     * Builds a conventional feature branch name from an issue ID and title.
     * e.g. fromParts('SCRUM-14', 'Add login page') → 'feature/SCRUM-14-add-login-page'
     */
    static fromParts(issueId: string, title: string): BranchName {
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);

        return new BranchName(`feature/${issueId}-${slug}`);
    }

    equals(other: BranchName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
