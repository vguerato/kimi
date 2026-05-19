/**
 * ISettingsRepository — Port for key/value settings persistence.
 *
 * Implementations live in infrastructure/. The domain and application
 * layers depend only on this interface (DIP).
 */
export interface ISettingsRepository {
    /** Returns all settings as a key/value map. */
    findAll(): Promise<Record<string, string>>;

    /** Returns the value for a single key, or null if not found. */
    findOne(key: string): Promise<string | null>;

    /** Upserts a single key/value pair. */
    upsert(key: string, value: string): Promise<void>;

    /** Upserts multiple key/value pairs in a single operation. */
    upsertMany(entries: Record<string, string>): Promise<void>;
}
