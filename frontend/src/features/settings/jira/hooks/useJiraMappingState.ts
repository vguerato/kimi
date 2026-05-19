import { useState, useEffect } from 'react';
import type { JiraMapping } from '../types';

/**
 * Manages local state for the Jira mapping UI.
 *
 * Design decisions:
 * - `triggerStatuses` — statuses that fire the agent when an issue moves to them.
 * - `skipStatuses`    — derived automatically: every status that is NOT a trigger
 *                       is considered "skip". We don't expose a separate skip toggle
 *                       in the UI; the backend just needs the list.
 * - `delegatableTypes` — issue types the agent can work on.
 * - `parentTypes`      — derived: types NOT in delegatableTypes are treated as parents.
 *                        Kept for backend compatibility.
 *
 * Syncs from the persisted mapping on first load.
 */
export function useJiraMappingState(
    persistedMapping: JiraMapping | null | undefined,
    allStatusNames: string[] = [],
    allTypeNames: string[] = [],
) {
    const [triggerStatuses, setTriggerStatuses] = useState<string[]>([]);
    const [delegatableTypes, setDelegatableTypes] = useState<string[]>([]);

    // Sync from server on first load (or when mapping changes)
    useEffect(() => {
        if (persistedMapping) {
            setTriggerStatuses(persistedMapping.triggerStatuses ?? []);
            setDelegatableTypes(persistedMapping.delegatableTypes ?? []);
        }
    }, [persistedMapping]);

    /** Toggle a status as trigger. If it was a trigger, remove it; otherwise add it. */
    const toggleStatus = (name: string) => {
        setTriggerStatuses(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name],
        );
    };

    /** Toggle a type as delegatable. */
    const toggleType = (name: string) => {
        setDelegatableTypes(prev =>
            prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name],
        );
    };

    // Derive skipStatuses and parentTypes from the full lists so the backend
    // always receives complete, consistent data.
    const skipStatuses = allStatusNames.filter(n => !triggerStatuses.includes(n));
    const parentTypes = allTypeNames.filter(n => !delegatableTypes.includes(n));

    const currentMapping: JiraMapping = {
        triggerStatuses,
        skipStatuses,
        delegatableTypes,
        parentTypes,
    };

    return {
        triggerStatuses,
        delegatableTypes,
        toggleStatus,
        toggleType,
        currentMapping,
    };
}
