import type { DatabaseOperations } from "@ccflare/database";
import type { ApiKey } from "@ccflare/database";
import {
	type PromptAdapter,
	stdPromptAdapter,
} from "../prompts/index";

export interface CreateApiKeyOptions {
	name: string;
	rateLimitRpm?: number;
	rateLimitTpm?: number;
	rateLimitRequestsPerDay?: number;
	adapter?: PromptAdapter;
}

export interface ApiKeyListItem {
	id: string;
	name: string;
	prefixLast8: string;
	createdAt: Date;
	lastUsed: Date | null;
	usageCount: number;
	totalRequests: number;
	totalTokens: number;
	totalCostUsd: number;
	isActive: boolean;
	rateLimitRpm: number | null;
	rateLimitTpm: number | null;
	rateLimitRequestsPerDay: number | null;
}

/**
 * Create a new API key
 */
export async function createApiKey(
	dbOps: DatabaseOperations,
	options: CreateApiKeyOptions,
): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
	const { name, rateLimitRpm, rateLimitTpm, rateLimitRequestsPerDay } = options;

	// Check if API key with this name already exists
	const apiKeyRepo = dbOps.getApiKeyRepository();
	const existing = apiKeyRepo.findByName(name);
	if (existing) {
		throw new Error(`API key with name '${name}' already exists`);
	}

	// Create the API key
	const result = apiKeyRepo.create({
		name,
		rate_limit_rpm: rateLimitRpm,
		rate_limit_tpm: rateLimitTpm,
		rate_limit_requests_per_day: rateLimitRequestsPerDay,
	});

	console.log(`\n✅ API key created successfully!`);
	console.log(`Name: ${result.apiKey.name}`);
	console.log(`Key: ${result.plainTextKey}`);
	console.log(`\n⚠️  IMPORTANT: Save this key now - you won't be able to see it again!`);

	if (rateLimitRequestsPerDay) {
		console.log(`Rate Limit: ${rateLimitRequestsPerDay} requests/day`);
	}
	if (rateLimitRpm) {
		console.log(`Rate Limit: ${rateLimitRpm} requests/minute`);
	}
	if (rateLimitTpm) {
		console.log(`Rate Limit: ${rateLimitTpm} tokens/minute`);
	}

	return result;
}

/**
 * List all API keys
 */
export function listApiKeys(dbOps: DatabaseOperations): ApiKeyListItem[] {
	const apiKeyRepo = dbOps.getApiKeyRepository();
	const apiKeys = apiKeyRepo.findAll();

	return apiKeys.map((key) => ({
		id: key.id,
		name: key.name,
		prefixLast8: key.prefix_last_8,
		createdAt: new Date(key.created_at),
		lastUsed: key.last_used ? new Date(key.last_used) : null,
		usageCount: key.usage_count,
		totalRequests: key.total_requests,
		totalTokens: key.total_tokens,
		totalCostUsd: key.total_cost_usd,
		isActive: key.is_active === 1,
		rateLimitRpm: key.rate_limit_rpm,
		rateLimitTpm: key.rate_limit_tpm,
		rateLimitRequestsPerDay: key.rate_limit_requests_per_day,
	}));
}

/**
 * Delete an API key
 */
export async function deleteApiKey(
	dbOps: DatabaseOperations,
	nameOrId: string,
	options: { adapter?: PromptAdapter } = {},
): Promise<void> {
	const { adapter = stdPromptAdapter } = options;
	const apiKeyRepo = dbOps.getApiKeyRepository();

	// Find the API key by name or ID
	let apiKey = apiKeyRepo.findByName(nameOrId);
	if (!apiKey) {
		apiKey = apiKeyRepo.findById(nameOrId);
	}

	if (!apiKey) {
		throw new Error(`API key '${nameOrId}' not found`);
	}

	// Confirm deletion
	const confirmed = await adapter.confirm(
		`Are you sure you want to delete API key '${apiKey.name}'?`,
		false,
	);

	if (!confirmed) {
		console.log("Deletion cancelled");
		return;
	}

	apiKeyRepo.delete(apiKey.id);
	console.log(`✅ API key '${apiKey.name}' deleted successfully`);
}

/**
 * Enable an API key
 */
export function enableApiKey(
	dbOps: DatabaseOperations,
	nameOrId: string,
): void {
	const apiKeyRepo = dbOps.getApiKeyRepository();

	// Find the API key
	let apiKey = apiKeyRepo.findByName(nameOrId);
	if (!apiKey) {
		apiKey = apiKeyRepo.findById(nameOrId);
	}

	if (!apiKey) {
		throw new Error(`API key '${nameOrId}' not found`);
	}

	apiKeyRepo.enable(apiKey.id);
	console.log(`✅ API key '${apiKey.name}' enabled`);
}

/**
 * Disable an API key
 */
export function disableApiKey(
	dbOps: DatabaseOperations,
	nameOrId: string,
): void {
	const apiKeyRepo = dbOps.getApiKeyRepository();

	// Find the API key
	let apiKey = apiKeyRepo.findByName(nameOrId);
	if (!apiKey) {
		apiKey = apiKeyRepo.findById(nameOrId);
	}

	if (!apiKey) {
		throw new Error(`API key '${nameOrId}' not found`);
	}

	apiKeyRepo.disable(apiKey.id);
	console.log(`✅ API key '${apiKey.name}' disabled`);
}

/**
 * Update rate limits for an API key
 */
export function updateApiKeyLimits(
	dbOps: DatabaseOperations,
	nameOrId: string,
	limits: {
		rpm?: number;
		tpm?: number;
		requestsPerDay?: number;
	},
): void {
	const apiKeyRepo = dbOps.getApiKeyRepository();

	// Find the API key
	let apiKey = apiKeyRepo.findByName(nameOrId);
	if (!apiKey) {
		apiKey = apiKeyRepo.findById(nameOrId);
	}

	if (!apiKey) {
		throw new Error(`API key '${nameOrId}' not found`);
	}

	apiKeyRepo.updateRateLimits(apiKey.id, limits);
	console.log(`✅ Rate limits updated for API key '${apiKey.name}'`);
}
