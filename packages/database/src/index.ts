// Re-export the main DatabaseOperations class and other utilities

export { AsyncDbWriter } from "./async-writer";
export type { RuntimeConfig } from "./database-operations";
export { DatabaseOperations } from "./database-operations";
export { DatabaseFactory } from "./factory";
// Re-export migrations for convenience
export { ensureSchema, runMigrations } from "./migrations";
export { resolveDbPath } from "./paths";
export { analyzeIndexUsage } from "./performance-indexes";
// Re-export API key types
export type {
	ApiKey,
	CreateApiKeyParams,
	CreateApiKeyResult,
} from "./repositories/api-key.repository";
export { ApiKeyRepository } from "./repositories/api-key.repository";
