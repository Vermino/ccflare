/**
 * Claude.ai Usage Service
 *
 * Fetches real usage data from Claude.ai API including:
 * - 5-hour session limits
 * - 7-day weekly limits (all models and opus-only)
 */

import { Logger } from "@ccflare/logger";
import type { Account } from "@ccflare/types";

const log = new Logger("ClaudeUsageService");

export interface ClaudeUsageData {
	five_hour: {
		utilization: number;
		resets_at: string | null;
	} | null;
	seven_day: {
		utilization: number;
		resets_at: string | null;
	} | null;
	seven_day_opus: {
		utilization: number;
		resets_at: string | null;
	} | null;
	seven_day_oauth_apps: {
		utilization: number;
		resets_at: string | null;
	} | null;
}

export interface ClaudeOrganization {
	id: string;
	name: string;
}

export class ClaudeUsageService {
	/**
	 * Fetch organization info for an account
	 */
	async getOrganizationId(account: Account): Promise<string | null> {
		if (!account.access_token) {
			log.warn(`No access token for account ${account.name}`);
			return null;
		}

		try {
			const response = await fetch("https://claude.ai/api/organizations", {
				headers: {
					Authorization: `Bearer ${account.access_token}`,
					"anthropic-client-platform": "web_claude_ai",
					"anthropic-client-version": "1.0.0",
				},
			});

			if (!response.ok) {
				log.error(
					`Failed to fetch organizations for ${account.name}: ${response.status}`,
				);
				return null;
			}

			const orgs = (await response.json()) as ClaudeOrganization[];
			if (orgs.length === 0) {
				log.warn(`No organizations found for account ${account.name}`);
				return null;
			}

			// Use the first organization
			const orgId = orgs[0].id;
			log.info(`Found organization ${orgId} for account ${account.name}`);
			return orgId;
		} catch (error) {
			log.error(
				`Error fetching organization for ${account.name}:`,
				error instanceof Error ? error.message : String(error),
			);
			return null;
		}
	}

	/**
	 * Fetch usage data from Claude.ai for an account
	 */
	async getUsageData(
		account: Account,
		organizationId: string,
	): Promise<ClaudeUsageData | null> {
		if (!account.access_token) {
			log.warn(`No access token for account ${account.name}`);
			return null;
		}

		try {
			const response = await fetch(
				`https://claude.ai/api/organizations/${organizationId}/usage`,
				{
					headers: {
						Authorization: `Bearer ${account.access_token}`,
						"anthropic-client-platform": "web_claude_ai",
						"anthropic-client-version": "1.0.0",
						Cookie: `sessionKey=${account.access_token}`,
					},
				},
			);

			if (!response.ok) {
				log.error(
					`Failed to fetch usage for ${account.name}: ${response.status}`,
				);
				return null;
			}

			const data = (await response.json()) as ClaudeUsageData;
			log.info(`Fetched usage data for ${account.name}:`, {
				five_hour: data.five_hour?.utilization,
				seven_day: data.seven_day?.utilization,
				seven_day_opus: data.seven_day_opus?.utilization,
			});

			return data;
		} catch (error) {
			log.error(
				`Error fetching usage for ${account.name}:`,
				error instanceof Error ? error.message : String(error),
			);
			return null;
		}
	}

	/**
	 * Fetch usage data for an account (auto-discovers organization ID)
	 */
	async getAccountUsage(account: Account): Promise<ClaudeUsageData | null> {
		// First, get the organization ID
		const orgId = await this.getOrganizationId(account);
		if (!orgId) {
			return null;
		}

		// Then fetch the usage data
		return await this.getUsageData(account, orgId);
	}

	/**
	 * Format usage data for display
	 */
	formatUsageData(data: ClaudeUsageData) {
		return {
			session: {
				percentage: data.five_hour?.utilization || 0,
				resetAt: data.five_hour?.resets_at,
			},
			weekly: {
				percentage: data.seven_day?.utilization || 0,
				resetAt: data.seven_day?.resets_at,
			},
			weeklyOpus: {
				percentage: data.seven_day_opus?.utilization || 0,
				resetAt: data.seven_day_opus?.resets_at,
			},
		};
	}
}
