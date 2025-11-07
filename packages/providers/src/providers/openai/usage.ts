import { Logger } from "@ccflare/logger";

const log = new Logger("OpenAIUsage");

export interface OpenAIUsageData {
	// Current billing period usage
	totalUsage: number; // Total USD spent
	dailyUsage: number; // USD spent today
	// Rate limits (from subscription)
	rateLimit: {
		requestsPerMinute: number | null;
		tokensPerMinute: number | null;
		requestsPerDay: number | null;
	};
	// Subscription info
	subscription: {
		hardLimitUsd: number | null; // Hard spending limit
		softLimitUsd: number | null; // Soft spending limit
		systemHardLimitUsd: number | null; // System-imposed limit
	};
}

/**
 * Fetches real usage data from OpenAI's API
 * Uses the billing/usage endpoint to get current usage
 */
export async function fetchOpenAIUsage(
	apiKey: string,
): Promise<OpenAIUsageData | null> {
	try {
		log.info("📊 Fetching OpenAI usage data");

		// Get current date range (start of current month to today)
		const now = new Date();
		const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
		const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

		const startDateStr = startDate.toISOString().split("T")[0];
		const endDateStr = endDate.toISOString().split("T")[0];

		// Fetch usage data
		const usageResponse = await fetch(
			`https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDateStr}&end_date=${endDateStr}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!usageResponse.ok) {
			log.error(
				`Failed to fetch OpenAI usage: ${usageResponse.status} ${usageResponse.statusText}`,
			);
			return null;
		}

		const usageData = (await usageResponse.json()) as {
			total_usage?: number; // In cents
			daily_costs?: Array<{
				timestamp: number;
				line_items?: Array<{
					name: string;
					cost: number;
				}>;
			}>;
		};

		// Fetch subscription/limits data
		const subscriptionResponse = await fetch(
			"https://api.openai.com/v1/dashboard/billing/subscription",
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json",
				},
			},
		);

		let subscriptionData: {
			hard_limit_usd?: number;
			soft_limit_usd?: number;
			system_hard_limit_usd?: number;
		} = {};

		if (subscriptionResponse.ok) {
			subscriptionData = (await subscriptionResponse.json()) as {
				hard_limit_usd?: number;
				soft_limit_usd?: number;
				system_hard_limit_usd?: number;
			};
		} else {
			log.warn(
				`Failed to fetch OpenAI subscription data: ${subscriptionResponse.status}`,
			);
		}

		// Calculate daily usage (last day in the array)
		let dailyUsage = 0;
		if (usageData.daily_costs && usageData.daily_costs.length > 0) {
			const lastDay = usageData.daily_costs[usageData.daily_costs.length - 1];
			if (lastDay.line_items) {
				dailyUsage = lastDay.line_items.reduce(
					(sum, item) => sum + (item.cost || 0),
					0,
				);
			}
		}

		const result: OpenAIUsageData = {
			totalUsage: (usageData.total_usage || 0) / 100, // Convert cents to dollars
			dailyUsage: dailyUsage / 100, // Convert cents to dollars
			rateLimit: {
				// These are typically returned in response headers per-request
				// Not available from billing API
				requestsPerMinute: null,
				tokensPerMinute: null,
				requestsPerDay: null,
			},
			subscription: {
				hardLimitUsd: subscriptionData.hard_limit_usd ?? null,
				softLimitUsd: subscriptionData.soft_limit_usd ?? null,
				systemHardLimitUsd: subscriptionData.system_hard_limit_usd ?? null,
			},
		};

		log.info(
			`✅ Got OpenAI usage: $${result.totalUsage.toFixed(2)} total, $${result.dailyUsage.toFixed(2)} today`,
		);
		log.info(
			`💳 Limits: hard=$${result.subscription.hardLimitUsd}, soft=$${result.subscription.softLimitUsd}`,
		);

		return result;
	} catch (error) {
		log.error("Error fetching OpenAI usage:", error);
		return null;
	}
}
