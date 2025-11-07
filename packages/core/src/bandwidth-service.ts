/**
 * Bandwidth Indicator Service
 *
 * Calculates predictable bandwidth usage and quota reset timing
 * for Claude API accounts based on database logs and rate limit headers.
 */

import type { Database } from "bun:sqlite";
import { Logger } from "@ccflare/logger";
import type {
	Account,
	BandwidthIndicator,
	BandwidthIndicatorResponse,
	QuotaType,
	RateLimitStatus,
	RateLimitWindow,
	TierQuotas,
	UsageMetrics,
} from "@ccflare/types";
import {
	calculateNextReset,
	formatQuotaUsage,
	formatTimeUntilReset,
} from "@ccflare/types";

export class BandwidthService {
	private log = new Logger("BandwidthService");
	private db: Database;

	constructor(database: Database) {
		this.db = database;
	}

	/**
	 * Get bandwidth indicator for a specific account
	 */
	async getBandwidthIndicator(
		accountId: string,
	): Promise<BandwidthIndicator | null> {
		// Get account information
		const account = this.getAccount(accountId);
		if (!account) {
			this.log.warn(`Account ${accountId} not found`);
			return null;
		}

		// Get current usage metrics
		const usage = await this.calculateUsageMetrics(accountId);

		// Get tier configuration
		const tierConfig = this.getTierConfiguration(account.account_tier);

		// Calculate rate limit statuses for all windows
		const rateLimits = this.calculateRateLimitStatuses(usage, tierConfig);

		// Generate predictions
		const predictions = this.generatePredictions(usage, tierConfig, account);

		// Determine overall status
		const { status, statusMessage } = this.determineOverallStatus(rateLimits);

		return {
			accountId: account.id,
			accountName: account.name,
			tier: account.account_tier,
			lastUpdated: Date.now(),
			rateLimits,
			predictions,
			status,
			statusMessage,
		};
	}

	/**
	 * Get bandwidth indicators for all accounts
	 */
	async getAllBandwidthIndicators(): Promise<BandwidthIndicator[]> {
		const accounts = this.getAllAccounts();
		const indicators: BandwidthIndicator[] = [];

		for (const account of accounts) {
			const indicator = await this.getBandwidthIndicator(account.id);
			if (indicator) {
				indicators.push(indicator);
			}
		}

		return indicators;
	}

	/**
	 * Convert bandwidth indicator to API response format
	 */
	toBandwidthResponse(
		indicator: BandwidthIndicator,
	): BandwidthIndicatorResponse {
		const tierConfig = this.getTierConfiguration(indicator.tier);

		// Find the most restrictive rate limit to determine next available time
		const allLimits = [
			indicator.rateLimits.requests.minute,
			indicator.rateLimits.requests.hour,
			indicator.rateLimits.requests.day,
			indicator.rateLimits.tokens.minute,
			indicator.rateLimits.tokens.hour,
			indicator.rateLimits.tokens.day,
		];

		const mostRestrictive = allLimits
			.filter((limit) => limit.isAtLimit)
			.sort((a, b) => a.resetTime - b.resetTime)[0];

		const nextAvailableAt = mostRestrictive
			? new Date(mostRestrictive.resetTime).toISOString()
			: new Date().toISOString();

		// Find the furthest reset time for "full reset"
		const furthestReset = Math.max(
			indicator.predictions.resetTimes.nextDayReset,
			indicator.predictions.resetTimes.nextMonthReset,
		);

		return {
			accountId: indicator.accountId,
			accountName: indicator.accountName,
			tier: indicator.tier,
			tierName: tierConfig.name,
			lastUpdated: new Date(indicator.lastUpdated).toISOString(),
			status: indicator.status,
			statusMessage: indicator.statusMessage,

			rateLimits: {
				requests: {
					current: formatQuotaUsage(
						indicator.rateLimits.requests.day.used,
						indicator.rateLimits.requests.day.limit,
						"requests",
					),
					percentage: indicator.rateLimits.requests.day.percentageUsed,
					resetIn: formatTimeUntilReset(
						indicator.rateLimits.requests.day.resetTime,
					),
					resetAt: new Date(
						indicator.rateLimits.requests.day.resetTime,
					).toISOString(),
				},
				tokens: {
					current: formatQuotaUsage(
						indicator.rateLimits.tokens.day.used,
						indicator.rateLimits.tokens.day.limit,
						"tokens",
					),
					percentage: indicator.rateLimits.tokens.day.percentageUsed,
					resetIn: formatTimeUntilReset(
						indicator.rateLimits.tokens.day.resetTime,
					),
					resetAt: new Date(
						indicator.rateLimits.tokens.day.resetTime,
					).toISOString(),
				},
				cost: {
					current: formatQuotaUsage(
						indicator.rateLimits.cost.month.used,
						indicator.rateLimits.cost.month.limit,
						"cost",
					),
					percentage: indicator.rateLimits.cost.month.percentageUsed,
					resetIn: formatTimeUntilReset(
						indicator.rateLimits.cost.month.resetTime,
					),
					resetAt: new Date(
						indicator.rateLimits.cost.month.resetTime,
					).toISOString(),
				},
			},

			predictions: {
				immediateCapacity: {
					requests: indicator.predictions.immediateCapacity.requests,
					tokens: indicator.predictions.immediateCapacity.tokens,
					canMakeRequests:
						indicator.predictions.immediateCapacity.requests > 0 &&
						indicator.predictions.immediateCapacity.tokens > 0,
				},
				nextAvailableAt,
				estimatedFullResetIn: formatTimeUntilReset(furthestReset),
			},
		};
	}

	/**
	 * Calculate usage metrics for an account across different time windows
	 */
	private async calculateUsageMetrics(
		accountId: string,
	): Promise<UsageMetrics> {
		const now = Date.now();
		const oneMinuteAgo = now - 60 * 1000;
		const oneHourAgo = now - 60 * 60 * 1000;
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000; // Approximate

		// Query requests within different time windows
		const minuteData = this.getUsageInTimeWindow(accountId, oneMinuteAgo, now);
		const hourData = this.getUsageInTimeWindow(accountId, oneHourAgo, now);
		const dayData = this.getUsageInTimeWindow(accountId, oneDayAgo, now);
		const monthData = this.getUsageInTimeWindow(accountId, oneMonthAgo, now);

		return {
			accountId,
			timestamp: now,
			usage: {
				requests: {
					lastMinute: minuteData.requests,
					lastHour: hourData.requests,
					lastDay: dayData.requests,
					lastMonth: monthData.requests,
				},
				tokens: {
					lastMinute: minuteData.tokens,
					lastHour: hourData.tokens,
					lastDay: dayData.tokens,
					lastMonth: monthData.tokens,
				},
				cost: {
					lastMonth: monthData.cost,
				},
			},
		};
	}

	/**
	 * Query usage data within a specific time window
	 */
	private getUsageInTimeWindow(
		accountId: string,
		startTime: number,
		endTime: number,
	): {
		requests: number;
		tokens: number;
		cost: number;
	} {
		const result = this.db
			.prepare(`
			SELECT 
				COUNT(*) as requests,
				COALESCE(SUM(total_tokens), 0) as tokens,
				COALESCE(SUM(cost_usd), 0) as cost
			FROM requests 
			WHERE account_used = ? 
			AND timestamp >= ? 
			AND timestamp <= ?
			AND success = 1
		`)
			.get(accountId, startTime, endTime) as {
			requests: number;
			tokens: number;
			cost: number;
		};

		return result || { requests: 0, tokens: 0, cost: 0 };
	}

	/**
	 * Calculate rate limit status for a specific quota type and window
	 */
	private calculateRateLimitStatus(
		used: number,
		limit: number,
		type: QuotaType,
		window: RateLimitWindow,
	): RateLimitStatus {
		const remaining = Math.max(0, limit - used);
		const percentageUsed = limit > 0 ? (used / limit) * 100 : 0;
		const resetTime = calculateNextReset(window);
		const secondsUntilReset = Math.max(
			0,
			Math.floor((resetTime - Date.now()) / 1000),
		);

		return {
			type,
			window,
			limit,
			used,
			remaining,
			resetTime,
			secondsUntilReset,
			percentageUsed,
			isNearLimit: percentageUsed >= 80,
			isAtLimit: percentageUsed >= 100,
		};
	}

	/**
	 * Calculate all rate limit statuses for an account
	 */
	private calculateRateLimitStatuses(
		usage: UsageMetrics,
		tierConfig: TierQuotas,
	) {
		return {
			requests: {
				minute: this.calculateRateLimitStatus(
					usage.usage.requests.lastMinute,
					tierConfig.quotas.requests.perMinute,
					"requests",
					"minute",
				),
				hour: this.calculateRateLimitStatus(
					usage.usage.requests.lastHour,
					tierConfig.quotas.requests.perHour,
					"requests",
					"hour",
				),
				day: this.calculateRateLimitStatus(
					usage.usage.requests.lastDay,
					tierConfig.quotas.requests.perDay,
					"requests",
					"day",
				),
				month: this.calculateRateLimitStatus(
					usage.usage.requests.lastMonth,
					tierConfig.quotas.requests.perMonth,
					"requests",
					"month",
				),
			},
			tokens: {
				minute: this.calculateRateLimitStatus(
					usage.usage.tokens.lastMinute,
					tierConfig.quotas.tokens.perMinute,
					"tokens",
					"minute",
				),
				hour: this.calculateRateLimitStatus(
					usage.usage.tokens.lastHour,
					tierConfig.quotas.tokens.perHour,
					"tokens",
					"hour",
				),
				day: this.calculateRateLimitStatus(
					usage.usage.tokens.lastDay,
					tierConfig.quotas.tokens.perDay,
					"tokens",
					"day",
				),
				month: this.calculateRateLimitStatus(
					usage.usage.tokens.lastMonth,
					tierConfig.quotas.tokens.perMonth,
					"tokens",
					"month",
				),
			},
			cost: {
				month: this.calculateRateLimitStatus(
					usage.usage.cost.lastMonth,
					tierConfig.quotas.cost.perMonth,
					"cost",
					"month",
				),
			},
		};
	}

	/**
	 * Generate predictions for future capacity
	 */
	private generatePredictions(
		usage: UsageMetrics,
		tierConfig: TierQuotas,
		_account: Account,
	) {
		// Calculate immediate capacity (most restrictive limit)
		const requestLimits = [
			tierConfig.quotas.requests.perMinute - usage.usage.requests.lastMinute,
			tierConfig.quotas.requests.perHour - usage.usage.requests.lastHour,
			tierConfig.quotas.requests.perDay - usage.usage.requests.lastDay,
		];
		const tokenLimits = [
			tierConfig.quotas.tokens.perMinute - usage.usage.tokens.lastMinute,
			tierConfig.quotas.tokens.perHour - usage.usage.tokens.lastHour,
			tierConfig.quotas.tokens.perDay - usage.usage.tokens.lastDay,
		];

		const immediateRequests = Math.max(0, Math.min(...requestLimits));
		const immediateTokens = Math.max(0, Math.min(...tokenLimits));

		// Find next reset time for capacity
		const nextResetTime = Math.min(
			calculateNextReset("minute"),
			calculateNextReset("hour"),
			calculateNextReset("day"),
		);

		// Calculate average usage patterns
		const requestsPerMinute = usage.usage.requests.lastHour / 60;
		const tokensPerMinute = usage.usage.tokens.lastHour / 60;
		const costPerHour = usage.usage.cost.lastMonth / (30 * 24); // Approximate

		return {
			immediateCapacity: {
				requests: immediateRequests,
				tokens: immediateTokens,
			},
			nextResetCapacity: {
				requests: tierConfig.quotas.requests.perMinute, // Will reset to full minute capacity
				tokens: tierConfig.quotas.tokens.perMinute,
				resetTime: nextResetTime,
				secondsUntilReset: Math.floor((nextResetTime - Date.now()) / 1000),
			},
			usagePatterns: {
				requestsPerMinute,
				tokensPerMinute,
				costPerHour,
			},
			resetTimes: {
				nextMinuteReset: calculateNextReset("minute"),
				nextHourReset: calculateNextReset("hour"),
				nextDayReset: calculateNextReset("day"),
				nextMonthReset: calculateNextReset("month"),
			},
		};
	}

	/**
	 * Determine overall account status based on rate limits
	 */
	private determineOverallStatus(rateLimits: any): {
		status: "healthy" | "warning" | "critical" | "rate_limited";
		statusMessage: string;
	} {
		// Check if any limits are exceeded
		const allLimits = [
			rateLimits.requests.minute,
			rateLimits.requests.hour,
			rateLimits.requests.day,
			rateLimits.tokens.minute,
			rateLimits.tokens.hour,
			rateLimits.tokens.day,
			rateLimits.cost.month,
		];

		const atLimit = allLimits.some((limit) => limit.isAtLimit);
		const nearLimit = allLimits.some((limit) => limit.isNearLimit);

		if (atLimit) {
			const limitedWindows = allLimits
				.filter((l) => l.isAtLimit)
				.map((l) => l.window);
			return {
				status: "rate_limited",
				statusMessage: `Rate limited (${limitedWindows.join(", ")})`,
			};
		}

		if (nearLimit) {
			const nearWindows = allLimits
				.filter((l) => l.isNearLimit && !l.isAtLimit)
				.map((l) => `${l.type} ${l.window}`);
			return {
				status: "warning",
				statusMessage: `Approaching limits: ${nearWindows.join(", ")}`,
			};
		}

		// Check if any limits are > 50%
		const heavyUsage = allLimits.some((limit) => limit.percentageUsed > 50);
		if (heavyUsage) {
			return {
				status: "warning",
				statusMessage: "Moderate usage detected",
			};
		}

		return {
			status: "healthy",
			statusMessage: "All quotas healthy",
		};
	}

	/**
	 * Get account by ID
	 */
	private getAccount(accountId: string): Account | null {
		const row = this.db
			.prepare("SELECT * FROM accounts WHERE id = ?")
			.get(accountId);
		return row ? this.mapAccountRow(row) : null;
	}

	/**
	 * Get all accounts
	 */
	private getAllAccounts(): Account[] {
		const rows = this.db
			.prepare("SELECT * FROM accounts WHERE paused = 0")
			.all();
		return rows.map((row) => this.mapAccountRow(row));
	}

	/**
	 * Map database row to Account object
	 */
	private mapAccountRow(row: any): Account {
		return {
			id: row.id,
			name: row.name,
			provider: row.provider || "anthropic",
			api_key: row.api_key,
			refresh_token: row.refresh_token,
			access_token: row.access_token,
			expires_at: row.expires_at,
			created_at: row.created_at,
			last_used: row.last_used,
			request_count: row.request_count || 0,
			total_requests: row.total_requests || 0,
			rate_limited_until: row.rate_limited_until,
			session_start: row.session_start,
			session_request_count: row.session_request_count || 0,
			account_tier: row.account_tier || 1,
			paused: row.paused === 1,
			rate_limit_reset: row.rate_limit_reset,
			rate_limit_status: row.rate_limit_status,
			rate_limit_remaining: row.rate_limit_remaining,
		};
	}

	/**
	 * Get tier configuration for an account tier
	 */
	private getTierConfiguration(tier: number): TierQuotas {
		// Import the TIER_CONFIGURATIONS constant
		const { TIER_CONFIGURATIONS } = require("@ccflare/types");
		return TIER_CONFIGURATIONS[tier] || TIER_CONFIGURATIONS[1]; // Default to free tier
	}
}
