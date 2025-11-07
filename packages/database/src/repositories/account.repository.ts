import { Logger } from "@ccflare/logger";
import { type Account, type AccountRow, toAccount } from "@ccflare/types";
import { BaseRepository } from "./base.repository";

const log = new Logger("AccountRepository");

export class AccountRepository extends BaseRepository<Account> {
	findAll(): Account[] {
		const rows = this.query<AccountRow>(`
			SELECT
				id, name, provider, api_key, refresh_token, access_token,
				expires_at, created_at, last_used, request_count, total_requests,
				rate_limited_until, session_start, session_request_count,
				COALESCE(account_tier, 1) as account_tier,
				COALESCE(paused, 0) as paused,
				rate_limit_reset, rate_limit_status, rate_limit_remaining,
				requests_limit, requests_remaining, requests_reset,
				tokens_limit, tokens_remaining, tokens_reset,
				input_tokens_limit, input_tokens_remaining, input_tokens_reset,
				output_tokens_limit, output_tokens_remaining, output_tokens_reset,
				unified_5h_status, unified_5h_reset,
				unified_7d_status, unified_7d_reset,
				unified_fallback_percentage, unified_representative_claim, unified_overage_disabled_reason
			FROM accounts
		`);
		return rows.map(toAccount);
	}

	findById(accountId: string): Account | null {
		const row = this.get<AccountRow>(
			`
			SELECT
				id, name, provider, api_key, refresh_token, access_token,
				expires_at, created_at, last_used, request_count, total_requests,
				rate_limited_until, session_start, session_request_count,
				COALESCE(account_tier, 1) as account_tier,
				COALESCE(paused, 0) as paused,
				rate_limit_reset, rate_limit_status, rate_limit_remaining,
				requests_limit, requests_remaining, requests_reset,
				tokens_limit, tokens_remaining, tokens_reset,
				input_tokens_limit, input_tokens_remaining, input_tokens_reset,
				output_tokens_limit, output_tokens_remaining, output_tokens_reset,
				unified_5h_status, unified_5h_reset,
				unified_7d_status, unified_7d_reset,
				unified_fallback_percentage, unified_representative_claim, unified_overage_disabled_reason
			FROM accounts
			WHERE id = ?
		`,
			[accountId],
		);

		return row ? toAccount(row) : null;
	}

	updateTokens(
		accountId: string,
		accessToken: string,
		expiresAt: number,
		refreshToken?: string,
	): void {
		if (refreshToken) {
			this.run(
				`UPDATE accounts SET access_token = ?, expires_at = ?, refresh_token = ? WHERE id = ?`,
				[accessToken, expiresAt, refreshToken, accountId],
			);
		} else {
			this.run(
				`UPDATE accounts SET access_token = ?, expires_at = ? WHERE id = ?`,
				[accessToken, expiresAt, accountId],
			);
		}
	}

	incrementUsage(accountId: string, sessionDurationMs: number): void {
		const now = Date.now();
		this.run(
			`
			UPDATE accounts 
			SET 
				last_used = ?,
				request_count = request_count + 1,
				total_requests = total_requests + 1,
				session_start = CASE
					WHEN session_start IS NULL OR ? - session_start >= ? THEN ?
					ELSE session_start
				END,
				session_request_count = CASE
					WHEN session_start IS NULL OR ? - session_start >= ? THEN 1
					ELSE session_request_count + 1
				END
			WHERE id = ?
		`,
			[now, now, sessionDurationMs, now, now, sessionDurationMs, accountId],
		);
	}

	setRateLimited(accountId: string, until: number): void {
		this.run(`UPDATE accounts SET rate_limited_until = ? WHERE id = ?`, [
			until,
			accountId,
		]);
	}

	updateRateLimitMeta(
		accountId: string,
		status: string,
		reset: number | null,
		remaining?: number | null,
		detailedLimits?: {
			requestsLimit?: number | null;
			requestsRemaining?: number | null;
			requestsReset?: number | null;
			tokensLimit?: number | null;
			tokensRemaining?: number | null;
			tokensReset?: number | null;
			inputTokensLimit?: number | null;
			inputTokensRemaining?: number | null;
			inputTokensReset?: number | null;
			outputTokensLimit?: number | null;
			outputTokensRemaining?: number | null;
			outputTokensReset?: number | null;
			// New unified rate limit fields
			unifiedFiveHourStatus?: string | null;
			unifiedFiveHourReset?: number | null;
			unifiedSevenDayStatus?: string | null;
			unifiedSevenDayReset?: number | null;
			unifiedFallbackPercentage?: number | null;
			unifiedRepresentativeClaim?: string | null;
			unifiedOverageDisabledReason?: string | null;
			organizationId?: string | null;
		},
	): void {
		if (detailedLimits) {
			// Update with detailed rate limit information
			log.info(
				`🔧 Updating rate limit meta for ${accountId}: fallback=${detailedLimits.unifiedFallbackPercentage}, claim=${detailedLimits.unifiedRepresentativeClaim}`,
			);
			try {
				this.run(
					`UPDATE accounts SET
					rate_limit_status = ?, rate_limit_reset = ?, rate_limit_remaining = ?,
					requests_limit = ?, requests_remaining = ?, requests_reset = ?,
					tokens_limit = ?, tokens_remaining = ?, tokens_reset = ?,
					input_tokens_limit = ?, input_tokens_remaining = ?, input_tokens_reset = ?,
					output_tokens_limit = ?, output_tokens_remaining = ?, output_tokens_reset = ?,
					unified_5h_status = ?, unified_5h_reset = ?,
					unified_7d_status = ?, unified_7d_reset = ?,
					unified_fallback_percentage = ?,
					unified_representative_claim = ?,
					unified_overage_disabled_reason = ?,
					organization_id = ?
				WHERE id = ?`,
					[
						status,
						reset,
						remaining ?? null,
						detailedLimits.requestsLimit ?? null,
						detailedLimits.requestsRemaining ?? null,
						detailedLimits.requestsReset ?? null,
						detailedLimits.tokensLimit ?? null,
						detailedLimits.tokensRemaining ?? null,
						detailedLimits.tokensReset ?? null,
						detailedLimits.inputTokensLimit ?? null,
						detailedLimits.inputTokensRemaining ?? null,
						detailedLimits.inputTokensReset ?? null,
						detailedLimits.outputTokensLimit ?? null,
						detailedLimits.outputTokensRemaining ?? null,
						detailedLimits.outputTokensReset ?? null,
						detailedLimits.unifiedFiveHourStatus ?? null,
						detailedLimits.unifiedFiveHourReset ?? null,
						detailedLimits.unifiedSevenDayStatus ?? null,
						detailedLimits.unifiedSevenDayReset ?? null,
						detailedLimits.unifiedFallbackPercentage ?? null,
						detailedLimits.unifiedRepresentativeClaim ?? null,
						detailedLimits.unifiedOverageDisabledReason ?? null,
						detailedLimits.organizationId ?? null,
						accountId,
					],
				);
				log.info(`✅ Successfully updated rate limit meta for ${accountId}`);
			} catch (error) {
				log.error(
					`❌ Failed to update rate limit meta for ${accountId}:`,
					error,
				);
				throw error;
			}
		} else {
			// Legacy update for backward compatibility
			this.run(
				`UPDATE accounts SET rate_limit_status = ?, rate_limit_reset = ?, rate_limit_remaining = ? WHERE id = ?`,
				[status, reset, remaining ?? null, accountId],
			);
		}
	}

	updateTier(accountId: string, tier: number): void {
		this.run(`UPDATE accounts SET account_tier = ? WHERE id = ?`, [
			tier,
			accountId,
		]);
	}

	pause(accountId: string): void {
		this.run(`UPDATE accounts SET paused = 1 WHERE id = ?`, [accountId]);
	}

	resume(accountId: string): void {
		this.run(`UPDATE accounts SET paused = 0 WHERE id = ?`, [accountId]);
	}

	resetSession(accountId: string, timestamp: number): void {
		this.run(
			`UPDATE accounts SET session_start = ?, session_request_count = 0 WHERE id = ?`,
			[timestamp, accountId],
		);
	}

	updateRequestCount(accountId: string, count: number): void {
		this.run(`UPDATE accounts SET session_request_count = ? WHERE id = ?`, [
			count,
			accountId,
		]);
	}

	rename(accountId: string, newName: string): void {
		this.run(`UPDATE accounts SET name = ? WHERE id = ?`, [newName, accountId]);
	}
}
