/**
 * Bandwidth Indicator Types
 *
 * Provides predictable bandwidth calculation and quota reset timing
 * for Claude API accounts across different tiers and rate limit windows.
 */

// Rate limit window types
export type RateLimitWindow = "minute" | "hour" | "day" | "month";

// Quota type indicators
export type QuotaType = "requests" | "tokens" | "cost";

// Account tier with specific quota mappings
export interface TierQuotas {
	tier: number; // 1, 5, 20
	name: string; // "Free", "Pro", "Team"
	quotas: {
		requests: {
			perMinute: number;
			perHour: number;
			perDay: number;
			perMonth: number;
		};
		tokens: {
			perMinute: number;
			perHour: number;
			perDay: number;
			perMonth: number;
		};
		cost: {
			perMonth: number; // USD
		};
	};
}

// Current usage metrics for an account
export interface UsageMetrics {
	accountId: string;
	timestamp: number;
	usage: {
		requests: {
			lastMinute: number;
			lastHour: number;
			lastDay: number;
			lastMonth: number;
		};
		tokens: {
			lastMinute: number;
			lastHour: number;
			lastDay: number;
			lastMonth: number;
		};
		cost: {
			lastMonth: number; // USD
		};
	};
}

// Rate limit status with reset predictions
export interface RateLimitStatus {
	type: QuotaType;
	window: RateLimitWindow;
	limit: number;
	used: number;
	remaining: number;
	resetTime: number; // Unix timestamp
	secondsUntilReset: number;
	percentageUsed: number;
	isNearLimit: boolean; // > 80%
	isAtLimit: boolean; // >= 100%
}

// Comprehensive bandwidth indicator for an account
export interface BandwidthIndicator {
	accountId: string;
	accountName: string;
	tier: number;
	lastUpdated: number;

	// Current rate limit statuses across all windows
	rateLimits: {
		requests: {
			minute: RateLimitStatus;
			hour: RateLimitStatus;
			day: RateLimitStatus;
			month: RateLimitStatus;
		};
		tokens: {
			minute: RateLimitStatus;
			hour: RateLimitStatus;
			day: RateLimitStatus;
			month: RateLimitStatus;
		};
		cost: {
			month: RateLimitStatus;
		};
	};

	// Predictive bandwidth availability
	predictions: {
		// How much capacity is available right now
		immediateCapacity: {
			requests: number;
			tokens: number;
		};

		// How much capacity will be available after next reset
		nextResetCapacity: {
			requests: number;
			tokens: number;
			resetTime: number;
			secondsUntilReset: number;
		};

		// Average usage patterns for prediction
		usagePatterns: {
			requestsPerMinute: number;
			tokensPerMinute: number;
			costPerHour: number;
		};

		// Time until different quotas reset
		resetTimes: {
			nextMinuteReset: number;
			nextHourReset: number;
			nextDayReset: number;
			nextMonthReset: number;
		};
	};

	// Overall health status
	status: "healthy" | "warning" | "critical" | "rate_limited";
	statusMessage: string;
}

// Response type for bandwidth API endpoints
export interface BandwidthIndicatorResponse {
	accountId: string;
	accountName: string;
	tier: number;
	tierName: string;
	lastUpdated: string; // ISO string

	// Current status summary
	status: "healthy" | "warning" | "critical" | "rate_limited";
	statusMessage: string;

	// Rate limit info in user-friendly format
	rateLimits: {
		requests: {
			current: string; // "45/100 requests"
			percentage: number; // 45
			resetIn: string; // "15 minutes"
			resetAt: string; // ISO string
		};
		tokens: {
			current: string; // "12.5K/50K tokens"
			percentage: number; // 25
			resetIn: string; // "45 minutes"
			resetAt: string; // ISO string
		};
		cost: {
			current: string; // "$15.50/$20.00"
			percentage: number; // 77.5
			resetIn: string; // "5 days"
			resetAt: string; // ISO string
		};
	};

	// Predictions
	predictions: {
		immediateCapacity: {
			requests: number;
			tokens: number;
			canMakeRequests: boolean;
		};
		nextAvailableAt: string; // ISO string - when capacity will be available
		estimatedFullResetIn: string; // "2 hours 15 minutes"
	};
}

// Configuration for different account tiers based on Claude API actual limits
export const TIER_CONFIGURATIONS: Record<number, TierQuotas> = {
	1: {
		// Pro tier (Claude Pro subscription)
		tier: 1,
		name: "Pro",
		quotas: {
			requests: {
				perMinute: 60, // Generous per-minute limit
				perHour: 1000, // 1000 requests per hour
				perDay: 20000, // 20,000 requests per day
				perMonth: 500000, // 500K requests per month
			},
			tokens: {
				perMinute: 200000, // 200K tokens per minute
				perHour: 2000000, // 2M tokens per hour
				perDay: 20000000, // 20M tokens per day
				perMonth: 500000000, // 500M tokens per month
			},
			cost: {
				perMonth: 20, // $20/month Pro subscription
			},
		},
	},
	5: {
		// Max tier (Claude Max/Team subscription)
		tier: 5,
		name: "Max",
		quotas: {
			requests: {
				perMinute: 1000, // Higher per-minute for Max
				perHour: 5000, // 5000 requests per hour
				perDay: 50000, // 50,000 requests per day
				perMonth: 1000000, // 1M requests per month
			},
			tokens: {
				perMinute: 500000, // 500K tokens per minute
				perHour: 5000000, // 5M tokens per hour
				perDay: 50000000, // 50M tokens per day
				perMonth: 1000000000, // 1B tokens per month
			},
			cost: {
				perMonth: 100, // Higher cost for Max tier
			},
		},
	},
};

// Utility functions for bandwidth calculations

/**
 * Calculate when the next reset will occur for a given window type
 */
export function calculateNextReset(
	window: RateLimitWindow,
	fromTime?: number,
): number {
	const now = fromTime || Date.now();
	const date = new Date(now);

	switch (window) {
		case "minute":
			// Next minute boundary
			date.setSeconds(0, 0);
			date.setMinutes(date.getMinutes() + 1);
			return date.getTime();

		case "hour":
			// Next hour boundary
			date.setMinutes(0, 0, 0);
			date.setHours(date.getHours() + 1);
			return date.getTime();

		case "day": {
			// Next day at UTC midnight
			const utcDate = new Date(
				date.getTime() + date.getTimezoneOffset() * 60000,
			);
			utcDate.setUTCHours(0, 0, 0, 0);
			utcDate.setUTCDate(utcDate.getUTCDate() + 1);
			return utcDate.getTime();
		}

		case "month": {
			// Next month at UTC midnight on 1st
			const utcMonth = new Date(
				date.getTime() + date.getTimezoneOffset() * 60000,
			);
			utcMonth.setUTCHours(0, 0, 0, 0);
			utcMonth.setUTCDate(1);
			utcMonth.setUTCMonth(utcMonth.getUTCMonth() + 1);
			return utcMonth.getTime();
		}

		default:
			return now + 60000; // Default to 1 minute
	}
}

/**
 * Format time until reset in human-readable format
 */
export function formatTimeUntilReset(
	resetTime: number,
	fromTime?: number,
): string {
	const now = fromTime || Date.now();
	const diff = resetTime - now;

	if (diff <= 0) return "now";

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0)
		return `${days} day${days > 1 ? "s" : ""} ${hours % 24} hour${hours % 24 !== 1 ? "s" : ""}`;
	if (hours > 0)
		return `${hours} hour${hours > 1 ? "s" : ""} ${minutes % 60} minute${minutes % 60 !== 1 ? "s" : ""}`;
	if (minutes > 0)
		return `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds % 60} second${seconds % 60 !== 1 ? "s" : ""}`;
	return `${seconds} second${seconds !== 1 ? "s" : ""}`;
}

/**
 * Format quota usage in human-readable format
 */
export function formatQuotaUsage(
	used: number,
	limit: number,
	type: QuotaType,
): string {
	switch (type) {
		case "requests":
			return `${used.toLocaleString()}/${limit.toLocaleString()} requests`;
		case "tokens":
			if (limit >= 1000000) {
				return `${(used / 1000000).toFixed(1)}M/${(limit / 1000000).toFixed(1)}M tokens`;
			}
			if (limit >= 1000) {
				return `${(used / 1000).toFixed(1)}K/${(limit / 1000).toFixed(1)}K tokens`;
			}
			return `${used}/${limit} tokens`;
		case "cost":
			return `$${used.toFixed(2)}/$${limit.toFixed(2)}`;
		default:
			return `${used}/${limit}`;
	}
}
