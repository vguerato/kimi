import { useState, useEffect } from 'react';
import type { PMMapping } from '../types';

/**
 * Manages local state for the project manager mapping UI.
 *
 * - `triggerStatuses`  — statuses that fire the agent when an issue moves to them.
 * - `skipStatuses`     — derived: every status NOT a trigger is considered "skip".
 * - `delegatableTypes` — issue types the agent can work on.
 * - `parentTypes`      — derived: types NOT in delegatableTypes are treated as parents.
 */
export function usePMMappingState(
    persistedMapping: PMMapping | null | undefined,
    allStatusNames: string[] = [],
    allTypeNames: string[] = [],
) {
    const [triggerStatuses, setTriggerStatuses] = useState<string[]>([]);
    const [delegatableTypes, setDelegatableTypes] = useState<string[]>([]);

    useEffect(() => {
        if (persistedMapping) {
            setTriggerStatuses(persistedMapping.triggerStatuses ?? []);
            setDelegatableTypes(persistedMapping.delegatableTypes ?? []);
        }
    }, [persistedMapping]);

    const toggleStatus = (name: string) => {
        setTriggerStatuses(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name],
        );
    };

    const toggleType = (name: string) => {
        setDelegatableTypes(prev =>
            prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name],
        );
    };

    const skipStatuses = allStatusNames.filter(n => !triggerStatuses.includes(n));
    const parentTypes = allTypeNames.filter(n => !delegatableTypes.includes(n));

    const currentMapping: PMMapping = {
        triggerStatuses,
        skipStatuses,
        delegatableTypes,
        parentTypes,
    };

    return { triggerStatuses, delegatableTypes, toggleStatus, toggleType, currentMapping };
}

/** @deprecated Use usePMMappingState */
export function useJiraMappingState(
    persistedMapping: PMMapping | null | undefined,
    allStatusNames: string[] = [],
    allTypeNames: string[] = [],
) {
    return usePMMappingState(persistedMapping, allStatusNames, allTypeNames);
}
