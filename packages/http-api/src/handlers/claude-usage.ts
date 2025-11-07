/**
 * Claude.ai Usage API Handler
 *
 * Returns usage data from database (populated by proxy response headers)
 */

import type { Database } from "bun:sqlite";
import { Logger } from "@ccflare/logger";
import { fetchClaudeUsage } from "@ccflare/providers";

const log = new Logger("ClaudeUsageHandler");

export async function handleClaudeUsage(db: Database): Promise<Response> {
	try {
		log.info("=== Claude Usage API called ===");

		// Get all accounts with rate limit data
		const accounts = db
			.prepare(`
				SELECT
					id, name, unified_fallback_percentage,
					unified_5h_status, unified_5h_reset,
					unified_7d_status, unified_7d_reset,
					unified_representative_claim,
					rate_limit_status,
					organization_id, access_token
				FROM accounts
				WHERE paused = 0
			`)
			.all() as any[];

		log.info(`Found ${accounts.length} accounts`);

		// Fetch real usage data in parallel for accounts with organization IDs
		const usageDataPromises = accounts.map(async (accountRow) => {
			// If we have organization_id and access_token, fetch real usage
			if (accountRow.organization_id && accountRow.access_token) {
				log.info(
					`🚀 Fetching REAL usage for ${accountRow.name} (org: ${accountRow.organization_id})`,
				);
				const realUsage = await fetchClaudeUsage(
					accountRow.organization_id,
					accountRow.access_token,
				);

				if (realUsage) {
					log.info(
						`✅ Real usage for ${accountRow.name}: 5h=${realUsage.fiveHour.utilization}%, 7d=${realUsage.sevenDay.utilization}%`,
					);
					return {
						accountId: accountRow.id,
						accountName: accountRow.name,
						usage: {
							session: {
								percentage: realUsage.fiveHour.utilization,
								resetAt: realUsage.fiveHour.resetsAt,
							},
							weekly: {
								percentage: realUsage.sevenDay.utilization,
								resetAt: realUsage.sevenDay.resetsAt,
							},
							weeklyOpus: {
								percentage: realUsage.sevenDayOpus.utilization,
								resetAt: realUsage.sevenDayOpus.resetsAt,
							},
						},
						raw: {
							unifiedFallbackPercentage: accountRow.unified_fallback_percentage,
							unifiedFiveHourStatus: accountRow.unified_5h_status,
							unifiedFiveHourReset: accountRow.unified_5h_reset,
							unifiedSevenDayStatus: accountRow.unified_7d_status,
							unifiedSevenDayReset: accountRow.unified_7d_reset,
							unifiedRepresentativeClaim:
								accountRow.unified_representative_claim,
							rateLimitStatus: accountRow.rate_limit_status,
							organizationId: accountRow.organization_id,
							isRealData: true,
						},
					};
				}
				log.warn(
					`⚠️ Failed to fetch real usage for ${accountRow.name}, falling back to header data`,
				);
			}

			// Fallback to header-based data
			const isFiveHourActive =
				accountRow.unified_representative_claim === "five_hour";
			const percentage = accountRow.unified_fallback_percentage || 0;
			const resetTime = isFiveHourActive
				? accountRow.unified_5h_reset
				: accountRow.unified_7d_reset;

			return {
				accountId: accountRow.id,
				accountName: accountRow.name,
				usage: {
					session: {
						percentage: isFiveHourActive ? percentage * 100 : 0,
						resetAt:
							isFiveHourActive && resetTime
								? new Date(resetTime).toISOString()
								: null,
					},
					weekly: {
						percentage: !isFiveHourActive ? percentage * 100 : 0,
						resetAt:
							!isFiveHourActive && resetTime
								? new Date(resetTime).toISOString()
								: null,
					},
					weeklyOpus: {
						percentage: 0,
						resetAt: null,
					},
				},
				raw: {
					unifiedFallbackPercentage: accountRow.unified_fallback_percentage,
					unifiedFiveHourStatus: accountRow.unified_5h_status,
					unifiedFiveHourReset: accountRow.unified_5h_reset,
					unifiedSevenDayStatus: accountRow.unified_7d_status,
					unifiedSevenDayReset: accountRow.unified_7d_reset,
					unifiedRepresentativeClaim: accountRow.unified_representative_claim,
					rateLimitStatus: accountRow.rate_limit_status,
					organizationId: accountRow.organization_id,
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
		log.error("Error fetching Claude usage:", error);
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
