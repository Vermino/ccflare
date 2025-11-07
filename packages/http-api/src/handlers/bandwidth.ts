/**
 * Bandwidth Indicator HTTP API Handlers
 *
 * Provides endpoints for retrieving predictable bandwidth usage
 * and quota reset information for Claude API accounts.
 */

import type { Database } from "bun:sqlite";
import { BandwidthService } from "../../../core/src/bandwidth-service";

/**
 * Create bandwidth handler for API routes
 */
export function createBandwidthHandler(db: Database) {
	const bandwidthService = new BandwidthService(db);

	return {
		/**
		 * GET /api/bandwidth - Get bandwidth indicators for all accounts
		 */
		getAllBandwidth: async (): Promise<Response> => {
			try {
				const indicators = await bandwidthService.getAllBandwidthIndicators();
				const responses = indicators.map((indicator) =>
					bandwidthService.toBandwidthResponse(indicator),
				);

				return new Response(
					JSON.stringify({
						success: true,
						data: responses,
						timestamp: new Date().toISOString(),
					}),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to get bandwidth indicators",
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		},

		/**
		 * GET /api/bandwidth/:accountId - Get bandwidth indicator for specific account
		 */
		getBandwidth: async (
			_req: Request,
			accountId: string,
		): Promise<Response> => {
			try {
				const indicator =
					await bandwidthService.getBandwidthIndicator(accountId);

				if (!indicator) {
					return new Response(
						JSON.stringify({
							success: false,
							error: "Account not found",
						}),
						{
							status: 404,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const response = bandwidthService.toBandwidthResponse(indicator);

				return new Response(
					JSON.stringify({
						success: true,
						data: response,
						timestamp: new Date().toISOString(),
					}),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to get bandwidth indicator",
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		},

		/**
		 * GET /api/bandwidth/summary - Get summary of bandwidth status across all accounts
		 */
		getBandwidthSummary: async (): Promise<Response> => {
			try {
				const indicators = await bandwidthService.getAllBandwidthIndicators();

				// Calculate summary statistics
				const summary = {
					totalAccounts: indicators.length,
					healthyAccounts: indicators.filter((i) => i.status === "healthy")
						.length,
					warningAccounts: indicators.filter((i) => i.status === "warning")
						.length,
					criticalAccounts: indicators.filter((i) => i.status === "critical")
						.length,
					rateLimitedAccounts: indicators.filter(
						(i) => i.status === "rate_limited",
					).length,

					// Aggregate capacity
					totalImmediateCapacity: {
						requests: indicators.reduce(
							(sum, i) => sum + i.predictions.immediateCapacity.requests,
							0,
						),
						tokens: indicators.reduce(
							(sum, i) => sum + i.predictions.immediateCapacity.tokens,
							0,
						),
					},

					// Next reset information
					nextResetTimes: indicators
						.map((i) => ({
							accountId: i.accountId,
							accountName: i.accountName,
							resetTime: i.predictions.nextResetCapacity.resetTime,
							secondsUntilReset:
								i.predictions.nextResetCapacity.secondsUntilReset,
						}))
						.sort((a, b) => a.resetTime - b.resetTime),

					// Account statuses
					accountStatuses: indicators.map((i) => ({
						accountId: i.accountId,
						accountName: i.accountName,
						tier: i.tier,
						status: i.status,
						statusMessage: i.statusMessage,
						immediateCapacity: i.predictions.immediateCapacity,
					})),
				};

				return new Response(
					JSON.stringify({
						success: true,
						data: summary,
						timestamp: new Date().toISOString(),
					}),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			} catch (error) {
				return new Response(
					JSON.stringify({
						success: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to get bandwidth summary",
					}),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		},
	};
}
