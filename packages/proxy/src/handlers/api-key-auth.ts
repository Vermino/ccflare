import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import type { ApiKey } from "@ccflare/database";

const log = new Logger("ApiKeyAuth");

export interface ApiKeyAuthResult {
	authenticated: boolean;
	apiKey?: ApiKey;
	error?: string;
}

/**
 * Extract API key from request headers
 * Supports multiple header formats:
 * - x-api-key: <key>
 * - Authorization: Bearer <key>
 */
export function extractApiKey(headers: Headers): string | null {
	// Try x-api-key header first
	const xApiKey = headers.get("x-api-key");
	if (xApiKey) {
		return xApiKey;
	}

	// Try Authorization: Bearer header
	const authHeader = headers.get("authorization");
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7);
	}

	return null;
}

/**
 * Authenticate request using API key
 */
export function authenticateApiKey(
	headers: Headers,
	dbOps: DatabaseOperations,
): ApiKeyAuthResult {
	const key = extractApiKey(headers);

	// If no API key provided, request is unauthenticated (may be allowed)
	if (!key) {
		return { authenticated: false };
	}

	// Validate the API key
	const apiKeyRepo = dbOps.getApiKeyRepository();
	const apiKey = apiKeyRepo.findByKey(key);

	if (!apiKey) {
		log.warn("Invalid API key provided");
		return {
			authenticated: false,
			error: "Invalid API key",
		};
	}

	if (!apiKey.is_active) {
		log.warn(`Inactive API key used: ${apiKey.name}`);
		return {
			authenticated: false,
			error: "API key is inactive",
		};
	}

	// Update last used timestamp
	apiKeyRepo.updateUsage(apiKey.id);

	log.info(`Authenticated request with API key: ${apiKey.name}`);

	return {
		authenticated: true,
		apiKey,
	};
}

/**
 * Check if API key has exceeded rate limits
 */
export function checkApiKeyRateLimits(apiKey: ApiKey): {
	allowed: boolean;
	error?: string;
} {
	// For now, we'll implement simple daily request limits
	// In the future, this can be enhanced with sliding window rate limiting

	if (
		apiKey.rate_limit_requests_per_day &&
		apiKey.total_requests >= apiKey.rate_limit_requests_per_day
	) {
		return {
			allowed: false,
			error: "Daily request limit exceeded",
		};
	}

	// TODO: Implement RPM and TPM limits with sliding window

	return { allowed: true };
}

/**
 * Middleware to enforce API key authentication
 * Returns 401 if authentication fails
 */
export function requireApiKey(
	headers: Headers,
	dbOps: DatabaseOperations,
): Response | null {
	const result = authenticateApiKey(headers, dbOps);

	if (!result.authenticated) {
		return new Response(
			JSON.stringify({
				error: result.error || "Authentication required",
				message: "Please provide a valid API key using x-api-key header",
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Check rate limits
	const rateLimitCheck = checkApiKeyRateLimits(result.apiKey!);
	if (!rateLimitCheck.allowed) {
		return new Response(
			JSON.stringify({
				error: "Rate limit exceeded",
				message: rateLimitCheck.error,
			}),
			{
				status: 429,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return null; // Authentication successful
}
