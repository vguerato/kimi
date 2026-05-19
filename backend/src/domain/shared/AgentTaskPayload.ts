/**
 * AgentTaskPayload — Shared data contract for agent task execution.
 *
 * Lives in domain/shared so it can be referenced by both the task queue
 * port and the worker infrastructure without creating circular imports.
 */
export interface AgentTaskPayload {
    /** The issue key being executed, e.g. SCRUM-14 */
    taskId: string;
    /** Key of the parent issue. Equals taskId for standalone tasks. */
    parentId: string;
    /** Title of the parent issue (context only) */
    parentTitle: string;
    /** Description of the parent issue (context only) */
    parentDescription: string;
    /** Repository prefix, e.g. "fin" */
    repository: string;
    /** Title of this specific task */
    title: string;
    /** Description of this specific task */
    description: string;
    /** Feature branch name, e.g. "feature/SCRUM-13-hello-world" */
    branch: string;
}
