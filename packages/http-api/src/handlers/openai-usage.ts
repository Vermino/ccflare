/**
 * OpenAI Usage API Handler
 *
 * Returns usage and billing data from OpenAI's API
 */

import type { Database } from "bun:sqlite";
import { Logger } from "@ccflare/logger";
import { fetchOpenAIUsage } from "@ccflare/providers";

const log = new Logger("OpenAIUsageHandler");

export async function handleOpenAIUsage(db: Database): Promise<Response> {
	try {
		log.info("=== OpenAI Usage API called ===");

		// Get all OpenAI accounts (API keys stored in refresh_token)
		const accounts = db
			.prepare(`
				SELECT
					id, name, refresh_token as api_key, provider
				FROM accounts
				WHERE paused = 0 AND provider = 'openai'
			`)
			.all() as Array<{
			id: string;
			name: string;
			api_key: string;
			provider: string;
		}>;

		log.info(`Found ${accounts.length} OpenAI accounts`);

		// Fetch real usage data in parallel for all OpenAI accounts
		const usageDataPromises = accounts.map(async (accountRow) => {
			log.info(`🚀 Fetching usage for OpenAI account: ${accountRow.name}`);

			const usageData = await fetchOpenAIUsage(accountRow.api_key);

			if (usageData) {
				log.info(
					`✅ OpenAI usage for ${accountRow.name}: $${usageData.totalUsage.toFixed(2)} total, $${usageData.dailyUsage.toFixed(2)} today`,
				);

				// Calculate usage percentage if limits are available
				let usagePercentage = 0;
				if (usageData.subscription.hardLimitUsd) {
					usagePercentage =
						(usageData.totalUsage / usageData.subscription.hardLimitUsd) * 100;
				} else if (usageData.subscription.softLimitUsd) {
					usagePercentage =
						(usageData.totalUsage / usageData.subscription.softLimitUsd) * 100;
				}

				return {
					accountId: accountRow.id,
					accountName: accountRow.name,
					usage: {
						totalUsage: usageData.totalUsage,
						dailyUsage: usageData.dailyUsage,
						usagePercentage,
						subscription: {
							hardLimitUsd: usageData.subscription.hardLimitUsd,
							softLimitUsd: usageData.subscription.softLimitUsd,
							systemHardLimitUsd: usageData.subscription.systemHardLimitUsd,
						},
						rateLimit: {
							requestsPerMinute: usageData.rateLimit.requestsPerMinute,
							tokensPerMinute: usageData.rateLimit.tokensPerMinute,
							requestsPerDay: usageData.rateLimit.requestsPerDay,
						},
					},
					raw: {
						isRealData: true,
					},
				};
			}

			log.warn(`⚠️ Failed to fetch usage for ${accountRow.name}`);

			return {
				accountId: accountRow.id,
				accountName: accountRow.name,
				usage: {
					totalUsage: 0,
					dailyUsage: 0,
					usagePercentage: 0,
					subscription: {
						hardLimitUsd: null,
						softLimitUsd: null,
						systemHardLimitUsd: null,
					},
					rateLimit: {
						requestsPerMinute: null,
						tokensPerMinute: null,
						requestsPerDay: null,
					},
				},
				raw: {
					isRealData: false,
				},
			};
		});

		const usageData = await Promise.all(usageDataPromises);

		return new Response(
			JSON.stringify({
				success: true,
				timestamp: new Date().toISOString(),
				data: usageData,
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		log.error("Error fetching OpenAI usage:", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
