import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";

const log = new Logger("ApiKeysHandler");

export function createApiKeysListHandler(dbOps: DatabaseOperations) {
	return async () => {
		try {
			const apiKeyRepo = dbOps.getApiKeyRepository();
			const apiKeys = apiKeyRepo.findAll();

			return new Response(
				JSON.stringify({
					apiKeys: apiKeys.map((key) => ({
						id: key.id,
						name: key.name,
						prefix_last_8: key.prefix_last_8,
						created_at: key.created_at,
						last_used: key.last_used,
						usage_count: key.usage_count,
						is_active: key.is_active === 1,
						total_requests: key.total_requests,
						total_tokens: key.total_tokens,
						total_cost_usd: key.total_cost_usd,
						rate_limit_rpm: key.rate_limit_rpm,
						rate_limit_tpm: key.rate_limit_tpm,
						rate_limit_requests_per_day: key.rate_limit_requests_per_day,
					})),
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Error listing API keys:", error);
			return new Response(
				JSON.stringify({ error: "Failed to list API keys" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	};
}

export function createApiKeyCreateHandler(dbOps: DatabaseOperations) {
	return async (req: Request) => {
		try {
			const body = await req.json();
			const { name, rate_limit_rpm, rate_limit_tpm, rate_limit_requests_per_day } =
				body;

			if (!name) {
				return new Response(
					JSON.stringify({ error: "Name is required" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const apiKeyRepo = dbOps.getApiKeyRepository();

			// Check if name already exists
			const existing = apiKeyRepo.findByName(name);
			if (existing) {
				return new Response(
					JSON.stringify({ error: `API key with name '${name}' already exists` }),
					{
						status: 409,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const result = apiKeyRepo.create({
				name,
				rate_limit_rpm,
				rate_limit_tpm,
				rate_limit_requests_per_day,
			});

			log.info(`Created API key: ${name}`);

			return new Response(
				JSON.stringify({
					apiKey: {
						id: result.apiKey.id,
						name: result.apiKey.name,
						prefix_last_8: result.apiKey.prefix_last_8,
						created_at: result.apiKey.created_at,
						is_active: result.apiKey.is_active === 1,
						rate_limit_rpm: result.apiKey.rate_limit_rpm,
						rate_limit_tpm: result.apiKey.rate_limit_tpm,
						rate_limit_requests_per_day: result.apiKey.rate_limit_requests_per_day,
					},
					plainTextKey: result.plainTextKey,
					warning: "Save this key - you won't be able to see it again!",
				}),
				{
					status: 201,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Error creating API key:", error);
			return new Response(
				JSON.stringify({ error: "Failed to create API key" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	};
}

export function createApiKeyDeleteHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL) => {
		try {
			const pathParts = url.pathname.split("/");
			const id = pathParts[pathParts.length - 1];

			const apiKeyRepo = dbOps.getApiKeyRepository();
			const apiKey = apiKeyRepo.findById(id);

			if (!apiKey) {
				return new Response(
					JSON.stringify({ error: "API key not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			apiKeyRepo.delete(id);
			log.info(`Deleted API key: ${apiKey.name}`);

			return new Response(
				JSON.stringify({
					success: true,
					message: "API key deleted successfully",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Error deleting API key:", error);
			return new Response(
				JSON.stringify({ error: "Failed to delete API key" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	};
}

export function createApiKeyEnableHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL) => {
		try {
			const pathParts = url.pathname.split("/");
			const id = pathParts[pathParts.length - 2]; // .../api-keys/:id/enable

			const apiKeyRepo = dbOps.getApiKeyRepository();
			const apiKey = apiKeyRepo.findById(id);

			if (!apiKey) {
				return new Response(
					JSON.stringify({ error: "API key not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			apiKeyRepo.enable(id);
			log.info(`Enabled API key: ${apiKey.name}`);

			return new Response(
				JSON.stringify({
					success: true,
					message: "API key enabled successfully",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Error enabling API key:", error);
			return new Response(
				JSON.stringify({ error: "Failed to enable API key" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	};
}

export function createApiKeyDisableHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL) => {
		try {
			const pathParts = url.pathname.split("/");
			const id = pathParts[pathParts.length - 2]; // .../api-keys/:id/disable

			const apiKeyRepo = dbOps.getApiKeyRepository();
			const apiKey = apiKeyRepo.findById(id);

			if (!apiKey) {
				return new Response(
					JSON.stringify({ error: "API key not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			apiKeyRepo.disable(id);
			log.info(`Disabled API key: ${apiKey.name}`);

			return new Response(
				JSON.stringify({
					success: true,
					message: "API key disabled successfully",
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Error disabling API key:", error);
			return new Response(
				JSON.stringify({ error: "Failed to disable API key" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	};
}
