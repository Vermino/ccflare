import crypto from "node:crypto";
import { Logger } from "@ccflare/logger";
import { BaseRepository } from "./base.repository";

const log = new Logger("ApiKeyRepository");

export interface ApiKey {
	id: string;
	name: string;
	hashed_key: string;
	prefix_last_8: string;
	created_at: number;
	last_used: number | null;
	usage_count: number;
	is_active: number;
	total_requests: number;
	total_tokens: number;
	total_cost_usd: number;
	rate_limit_rpm: number | null;
	rate_limit_tpm: number | null;
	rate_limit_requests_per_day: number | null;
}

export interface ApiKeyRow {
	id: string;
	name: string;
	hashed_key: string;
	prefix_last_8: string;
	created_at: number;
	last_used: number | null;
	usage_count: number;
	is_active: number;
	total_requests: number;
	total_tokens: number;
	total_cost_usd: number;
	rate_limit_rpm: number | null;
	rate_limit_tpm: number | null;
	rate_limit_requests_per_day: number | null;
}

export interface CreateApiKeyParams {
	name: string;
	rate_limit_rpm?: number;
	rate_limit_tpm?: number;
	rate_limit_requests_per_day?: number;
}

export interface CreateApiKeyResult {
	apiKey: ApiKey;
	plainTextKey: string;
}

export class ApiKeyRepository extends BaseRepository<ApiKey> {
	/**
	 * Hash an API key using SHA-256
	 */
	private hashKey(key: string): string {
		return crypto.createHash("sha256").update(key).digest("hex");
	}

	/**
	 * Generate a secure random API key
	 */
	private generateKey(): string {
		return `ccf_${crypto.randomBytes(32).toString("hex")}`;
	}

	/**
	 * Get the last 8 characters of a key for display purposes
	 */
	private getPrefixLast8(key: string): string {
		return key.slice(-8);
	}

	/**
	 * Create a new API key
	 */
	create(params: CreateApiKeyParams): CreateApiKeyResult {
		const plainTextKey = this.generateKey();
		const hashedKey = this.hashKey(plainTextKey);
		const id = crypto.randomUUID();

		this.run(
			`INSERT INTO api_keys (
				id, name, hashed_key, prefix_last_8, created_at, is_active,
				rate_limit_rpm, rate_limit_tpm, rate_limit_requests_per_day
			) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
			[
				id,
				params.name,
				hashedKey,
				this.getPrefixLast8(plainTextKey),
				Date.now(),
				params.rate_limit_rpm ?? null,
				params.rate_limit_tpm ?? null,
				params.rate_limit_requests_per_day ?? null,
			],
		);

		const apiKey = this.findById(id);
		if (!apiKey) {
			throw new Error("Failed to create API key");
		}

		log.info(`Created API key: ${params.name}`);

		return {
			apiKey,
			plainTextKey,
		};
	}

	/**
	 * Find an API key by ID
	 */
	findById(id: string): ApiKey | null {
		return this.get<ApiKeyRow>(
			`SELECT * FROM api_keys WHERE id = ?`,
			[id],
		) as ApiKey | null;
	}

	/**
	 * Find an API key by its hashed value
	 */
	findByKey(plainTextKey: string): ApiKey | null {
		const hashedKey = this.hashKey(plainTextKey);
		return this.get<ApiKeyRow>(
			`SELECT * FROM api_keys WHERE hashed_key = ? AND is_active = 1`,
			[hashedKey],
		) as ApiKey | null;
	}

	/**
	 * Find an API key by name
	 */
	findByName(name: string): ApiKey | null {
		return this.get<ApiKeyRow>(
			`SELECT * FROM api_keys WHERE name = ?`,
			[name],
		) as ApiKey | null;
	}

	/**
	 * Get all API keys
	 */
	findAll(): ApiKey[] {
		return this.query<ApiKeyRow>(
			`SELECT * FROM api_keys ORDER BY created_at DESC`,
		) as ApiKey[];
	}

	/**
	 * Get all active API keys
	 */
	findActive(): ApiKey[] {
		return this.query<ApiKeyRow>(
			`SELECT * FROM api_keys WHERE is_active = 1 ORDER BY created_at DESC`,
		) as ApiKey[];
	}

	/**
	 * Update API key usage statistics
	 */
	updateUsage(id: string): void {
		this.run(
			`UPDATE api_keys SET
				usage_count = usage_count + 1,
				last_used = ?
			WHERE id = ?`,
			[Date.now(), id],
		);
	}

	/**
	 * Update API key usage with token and cost tracking
	 */
	updateUsageWithMetrics(
		id: string,
		tokens: number,
		costUsd: number,
	): void {
		this.run(
			`UPDATE api_keys SET
				usage_count = usage_count + 1,
				total_requests = total_requests + 1,
				total_tokens = total_tokens + ?,
				total_cost_usd = total_cost_usd + ?,
				last_used = ?
			WHERE id = ?`,
			[tokens, costUsd, Date.now(), id],
		);
	}

	/**
	 * Disable an API key
	 */
	disable(id: string): void {
		this.run(`UPDATE api_keys SET is_active = 0 WHERE id = ?`, [id]);
		log.info(`Disabled API key: ${id}`);
	}

	/**
	 * Enable an API key
	 */
	enable(id: string): void {
		this.run(`UPDATE api_keys SET is_active = 1 WHERE id = ?`, [id]);
		log.info(`Enabled API key: ${id}`);
	}

	/**
	 * Delete an API key
	 */
	delete(id: string): void {
		this.run(`DELETE FROM api_keys WHERE id = ?`, [id]);
		log.info(`Deleted API key: ${id}`);
	}

	/**
	 * Update rate limits for an API key
	 */
	updateRateLimits(
		id: string,
		limits: {
			rpm?: number | null;
			tpm?: number | null;
			requestsPerDay?: number | null;
		},
	): void {
		this.run(
			`UPDATE api_keys SET
				rate_limit_rpm = ?,
				rate_limit_tpm = ?,
				rate_limit_requests_per_day = ?
			WHERE id = ?`,
			[
				limits.rpm ?? null,
				limits.tpm ?? null,
				limits.requestsPerDay ?? null,
				id,
			],
		);
		log.info(`Updated rate limits for API key: ${id}`);
	}

	/**
	 * Count all API keys
	 */
	countAll(): number {
		const result = this.get<{ count: number }>(
			`SELECT COUNT(*) as count FROM api_keys`,
		);
		return result?.count ?? 0;
	}

	/**
	 * Count active API keys
	 */
	countActive(): number {
		const result = this.get<{ count: number }>(
			`SELECT COUNT(*) as count FROM api_keys WHERE is_active = 1`,
		);
		return result?.count ?? 0;
	}
}
