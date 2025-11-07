import { logError, RateLimitError } from "@ccflare/core";
import { Logger } from "@ccflare/logger";
import type { Provider } from "@ccflare/providers";
import type { Account } from "@ccflare/types";
import type { ProxyContext } from "./proxy-types";

const log = new Logger("ResponseProcessor");

/**
 * Handles rate limit response for an account
 * @param account - The rate-limited account
 * @param rateLimitInfo - Parsed rate limit information
 * @param ctx - The proxy context
 */
export function handleRateLimitResponse(
	account: Account,
	rateLimitInfo: ReturnType<Provider["parseRateLimit"]>,
	ctx: ProxyContext,
): void {
	if (!rateLimitInfo.resetTime) return;

	log.warn(
		`Account ${account.name} rate-limited until ${new Date(
			rateLimitInfo.resetTime,
		).toISOString()}`,
	);

	const resetTime = rateLimitInfo.resetTime;
	ctx.asyncWriter.enqueue(() =>
		ctx.dbOps.markAccountRateLimited(account.id, resetTime),
	);

	const rateLimitError = new RateLimitError(
		account.id,
		rateLimitInfo.resetTime,
		rateLimitInfo.remaining,
	);
	logError(rateLimitError, log);
}

/**
 * Updates account metadata in the background
 * @param account - The account to update
 * @param response - The response to extract metadata from
 * @param ctx - The proxy context
 */
export function updateAccountMetadata(
	account: Account,
	response: Response,
	ctx: ProxyContext,
): void {
	// Update basic usage
	ctx.asyncWriter.enqueue(() => ctx.dbOps.updateAccountUsage(account.id));

	// Extract and update rate limit info for every response
	const rateLimitInfo = ctx.provider.parseRateLimit(response);

	// DEBUG
	if (rateLimitInfo.unifiedFallbackPercentage !== undefined) {
		log.info(
			`📊 Rate limit data: fallback=${rateLimitInfo.unifiedFallbackPercentage}, status=${rateLimitInfo.statusHeader}`,
		);
	}

	// Update rate limit metadata when we have any rate limit data
	if (
		rateLimitInfo.statusHeader ||
		rateLimitInfo.unifiedFallbackPercentage !== undefined
	) {
		const status = rateLimitInfo.statusHeader || "unknown";
		log.info(`💾 Enqueueing database update for ${account.name}`);
		ctx.asyncWriter.enqueue(() =>
			ctx.dbOps.updateAccountRateLimitMeta(
				account.id,
				status,
				rateLimitInfo.resetTime ?? null,
				rateLimitInfo.remaining,
				{
					requestsLimit: rateLimitInfo.requestsLimit ?? null,
					requestsRemaining: rateLimitInfo.requestsRemaining ?? null,
					requestsReset: rateLimitInfo.requestsReset ?? null,
					tokensLimit: rateLimitInfo.tokensLimit ?? null,
					tokensRemaining: rateLimitInfo.tokensRemaining ?? null,
					tokensReset: rateLimitInfo.tokensReset ?? null,
					inputTokensLimit: rateLimitInfo.inputTokensLimit ?? null,
					inputTokensRemaining: rateLimitInfo.inputTokensRemaining ?? null,
					inputTokensReset: rateLimitInfo.inputTokensReset ?? null,
					outputTokensLimit: rateLimitInfo.outputTokensLimit ?? null,
					outputTokensRemaining: rateLimitInfo.outputTokensRemaining ?? null,
					outputTokensReset: rateLimitInfo.outputTokensReset ?? null,
					// New unified rate limit fields
					unifiedFiveHourStatus: rateLimitInfo.unifiedFiveHourStatus ?? null,
					unifiedFiveHourReset: rateLimitInfo.unifiedFiveHourReset ?? null,
					unifiedSevenDayStatus: rateLimitInfo.unifiedSevenDayStatus ?? null,
					unifiedSevenDayReset: rateLimitInfo.unifiedSevenDayReset ?? null,
					unifiedFallbackPercentage:
						rateLimitInfo.unifiedFallbackPercentage ?? null,
					unifiedRepresentativeClaim:
						rateLimitInfo.unifiedRepresentativeClaim ?? null,
					unifiedOverageDisabledReason:
						rateLimitInfo.unifiedOverageDisabledReason ?? null,
					organizationId: rateLimitInfo.organizationId ?? null,
				},
			),
		);
	}

	// Extract tier info if supported
	if (ctx.provider.extractTierInfo) {
		const extractTierInfo = ctx.provider.extractTierInfo.bind(ctx.provider);
		(async () => {
			const tier = await extractTierInfo(response.clone() as Response);
			if (tier && tier !== account.account_tier) {
				log.info(
					`Updating account ${account.name} tier from ${account.account_tier} to ${tier}`,
				);
				ctx.asyncWriter.enqueue(() =>
					ctx.dbOps.updateAccountTier(account.id, tier),
				);
			}
		})();
	}
}

/**
 * Processes a successful proxy response
 * @param response - The provider response
 * @param account - The account used
 * @param ctx - The proxy context
 * @returns Whether the response is rate-limited
 */
export function processProxyResponse(
	response: Response,
	account: Account,
	ctx: ProxyContext,
): boolean {
	const isStream = ctx.provider.isStreamingResponse?.(response) ?? false;
	const rateLimitInfo = ctx.provider.parseRateLimit(response);

	// Handle rate limit
	if (!isStream && rateLimitInfo.isRateLimited && rateLimitInfo.resetTime) {
		handleRateLimitResponse(account, rateLimitInfo, ctx);
		// Also update metadata for rate-limited responses
		updateAccountMetadata(account, response, ctx);
		return true; // Signal rate limit
	}

	// Update account metadata in background
	updateAccountMetadata(account, response, ctx);
	return false;
}

/**
 * Handles errors that occur during proxy operations
 * @param error - The error that occurred
 * @param account - The account that failed (optional)
 * @param logger - Logger instance
 */
export function handleProxyError(
	error: unknown,
	account: Account | null,
	logger: Logger,
): void {
	logError(error, logger);
	if (account) {
		logger.error(`Failed to proxy request with account ${account.name}`);
	} else {
		logger.error("Failed to proxy request");
	}
}
