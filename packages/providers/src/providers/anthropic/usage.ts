import { Logger } from "@ccflare/logger";

const log = new Logger("AnthropicUsage");

export interface ClaudeUsageData {
	fiveHour: {
		utilization: number; // 0-100 percentage
		resetsAt: string | null; // ISO timestamp
	};
	sevenDay: {
		utilization: number;
		resetsAt: string | null;
	};
	sevenDayOauthApps: {
		utilization: number;
		resetsAt: string | null;
	};
	sevenDayOpus: {
		utilization: number;
		resetsAt: string | null;
	};
}

/**
 * Fetches REAL usage data from Claude.ai's usage API
 * This is what the actual Claude.ai web app uses
 */
export async function fetchClaudeUsage(
	organizationId: string,
	accessToken: string,
): Promise<ClaudeUsageData | null> {
	try {
		log.info(`📊 Fetching real usage data for org: ${organizationId}`);

		const response = await fetch(
			`https://claude.ai/api/organizations/${organizationId}/usage`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"anthropic-client-platform": "web_claude_ai",
					"anthropic-client-version": "1.0.0",
				},
			},
		);

		if (!response.ok) {
			log.error(
				`Failed to fetch usage data: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const data = (await response.json()) as {
			five_hour?: {
				utilization?: number;
				resets_at?: string | null;
			};
			seven_day?: {
				utilization?: number;
				resets_at?: string | null;
			};
			seven_day_oauth_apps?: {
				utilization?: number;
				resets_at?: string | null;
			};
			seven_day_opus?: {
				utilization?: number;
				resets_at?: string | null;
			};
		};

		const usageData: ClaudeUsageData = {
			fiveHour: {
				utilization: data.five_hour?.utilization ?? 0,
				resetsAt: data.five_hour?.resets_at ?? null,
			},
			sevenDay: {
				utilization: data.seven_day?.utilization ?? 0,
				resetsAt: data.seven_day?.resets_at ?? null,
			},
			sevenDayOauthApps: {
				utilization: data.seven_day_oauth_apps?.utilization ?? 0,
				resetsAt: data.seven_day_oauth_apps?.resets_at ?? null,
			},
			sevenDayOpus: {
				utilization: data.seven_day_opus?.utilization ?? 0,
				resetsAt: data.seven_day_opus?.resets_at ?? null,
			},
		};

		log.info(
			`✅ Got real usage: 5h=${usageData.fiveHour.utilization}%, 7d=${usageData.sevenDay.utilization}%`,
		);

		return usageData;
	} catch (error) {
		log.error("Error fetching Claude usage:", error);
		return null;
	}
}
