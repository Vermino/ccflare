import type { Account } from "@ccflare/core";
import { Logger } from "@ccflare/logger";
import { BaseProvider } from "../../base";
import type { RateLimitInfo, TokenRefreshResult } from "../../types";

const log = new Logger("OpenAIProvider");

export class OpenAIProvider extends BaseProvider {
	name = "openai";

	canHandle(path: string): boolean {
		// Handle OpenAI API paths
		return path.startsWith("/v1/");
	}

	async refreshToken(
		account: Account,
		_clientId: string,
	): Promise<TokenRefreshResult> {
		// OpenAI uses API keys that don't expire, so we just return the existing token
		// The "refresh_token" field in the database will actually store the API key for OpenAI accounts
		if (!account.refresh_token) {
			throw new Error(
				`No API key available for OpenAI account ${account.name}`,
			);
		}

		log.info(`Using API key for OpenAI account ${account.name}`);

		// Return the API key as the access token
		// Set a far future expiry since API keys don't expire
		return {
			accessToken: account.refresh_token,
			expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
			refreshToken: account.refresh_token, // Keep the same API key
		};
	}

	buildUrl(path: string, query: string): string {
		return `https://api.openai.com${path}${query}`;
	}

	prepareHeaders(headers: Headers, accessToken?: string): Headers {
		const newHeaders = super.prepareHeaders(headers, accessToken);
		// Remove compression headers to avoid decompression issues
		newHeaders.delete("accept-encoding");
		newHeaders.delete("content-encoding");
		return newHeaders;
	}

	parseRateLimit(response: Response): RateLimitInfo {
		// Extract OpenAI rate limit headers
		const headers = response.headers;

		// OpenAI uses x-ratelimit-* headers
		const limitRequests = headers.get("x-ratelimit-limit-requests");
		const remainingRequests = headers.get("x-ratelimit-remaining-requests");
		const resetRequests = headers.get("x-ratelimit-reset-requests");

		const limitTokens = headers.get("x-ratelimit-limit-tokens");
		const remainingTokens = headers.get("x-ratelimit-remaining-tokens");
		const resetTokens = headers.get("x-ratelimit-reset-tokens");

		// Parse reset time - OpenAI sends it as a duration string like "6m0s" or "1h2m3s"
		const parseResetDuration = (resetStr: string | null): number | undefined => {
			if (!resetStr) return undefined;

			// Parse duration strings like "6m0s", "1h2m3s", "42s"
			const hours = resetStr.match(/(\d+)h/)?.[1];
			const minutes = resetStr.match(/(\d+)m/)?.[1];
			const seconds = resetStr.match(/(\d+)s/)?.[1];

			const totalMs =
				(hours ? parseInt(hours) * 60 * 60 * 1000 : 0) +
				(minutes ? parseInt(minutes) * 60 * 1000 : 0) +
				(seconds ? parseInt(seconds) * 1000 : 0);

			return totalMs > 0 ? Date.now() + totalMs : undefined;
		};

		const requestsResetTime = parseResetDuration(resetRequests);
		const tokensResetTime = parseResetDuration(resetTokens);

		// Determine if rate limited
		const isRateLimited =
			response.status === 429 ||
			remainingRequests === "0" ||
			remainingTokens === "0";

		// Use the earliest reset time
		const resetTime =
			requestsResetTime && tokensResetTime
				? Math.min(requestsResetTime, tokensResetTime)
				: requestsResetTime || tokensResetTime;

		// Fall back to retry-after header for 429 responses
		if (response.status === 429 && !resetTime) {
			const retryAfter = headers.get("retry-after");
			const fallbackResetTime = retryAfter
				? Date.now() + parseInt(retryAfter) * 1000
				: Date.now() + 60000;

			return {
				isRateLimited: true,
				resetTime: fallbackResetTime,
				requestsLimit: limitRequests ? Number(limitRequests) : undefined,
				requestsRemaining: remainingRequests
					? Number(remainingRequests)
					: undefined,
				tokensLimit: limitTokens ? Number(limitTokens) : undefined,
				tokensRemaining: remainingTokens ? Number(remainingTokens) : undefined,
			};
		}

		return {
			isRateLimited,
			resetTime,
			requestsLimit: limitRequests ? Number(limitRequests) : undefined,
			requestsRemaining: remainingRequests
				? Number(remainingRequests)
				: undefined,
			requestsReset: requestsResetTime,
			tokensLimit: limitTokens ? Number(limitTokens) : undefined,
			tokensRemaining: remainingTokens ? Number(remainingTokens) : undefined,
			tokensReset: tokensResetTime,
		};
	}

	async processResponse(
		response: Response,
		_account: Account | null,
	): Promise<Response> {
		// Strip Content-Encoding header to avoid decompression issues
		const headers = new Headers(response.headers);
		headers.delete("content-encoding");
		headers.delete("Content-Encoding");

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	async extractUsageInfo(response: Response): Promise<{
		model?: string;
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
		costUsd?: number;
		inputTokens?: number;
		outputTokens?: number;
	} | null> {
		try {
			const clone = response.clone();
			const contentType = response.headers.get("content-type");

			// Handle streaming responses (SSE)
			if (contentType?.includes("text/event-stream")) {
				// For streaming, we need to parse SSE events
				const reader = clone.body?.getReader();
				if (!reader) return null;

				let buffered = "";
				const maxBytes = 32768; // 32 KB cap
				const decoder = new TextDecoder();
				let model: string | undefined;
				let promptTokens = 0;
				let completionTokens = 0;

				try {
					while (buffered.length < maxBytes) {
						const { value, done } = await reader.read();
						if (done) break;

						buffered += decoder.decode(value, { stream: true });

						// Look for the final usage chunk
						if (buffered.includes("data: [DONE]")) {
							break;
						}
					}
				} finally {
					reader.cancel().catch(() => {});
				}

				// Parse the buffered content for usage data
				const lines = buffered.split("\n");
				for (const line of lines) {
					if (line.startsWith("data: ") && line !== "data: [DONE]") {
						try {
							const jsonStr = line.slice(6);
							const data = JSON.parse(jsonStr) as {
								model?: string;
								usage?: {
									prompt_tokens?: number;
									completion_tokens?: number;
									total_tokens?: number;
								};
							};

							if (data.model) model = data.model;
							if (data.usage) {
								promptTokens = data.usage.prompt_tokens || 0;
								completionTokens = data.usage.completion_tokens || 0;
							}
						} catch {
							// Ignore parse errors
						}
					}
				}

				if (model && (promptTokens > 0 || completionTokens > 0)) {
					return {
						model,
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens,
						inputTokens: promptTokens,
						outputTokens: completionTokens,
					};
				}

				return null;
			} else {
				// Handle non-streaming JSON responses
				const json = (await clone.json()) as {
					model?: string;
					usage?: {
						prompt_tokens?: number;
						completion_tokens?: number;
						total_tokens?: number;
					};
				};

				if (!json.usage) return null;

				const promptTokens = json.usage.prompt_tokens || 0;
				const completionTokens = json.usage.completion_tokens || 0;
				const totalTokens = json.usage.total_tokens || 0;

				return {
					model: json.model,
					promptTokens,
					completionTokens,
					totalTokens,
					inputTokens: promptTokens,
					outputTokens: completionTokens,
				};
			}
		} catch {
			// Ignore parsing errors
			return null;
		}
	}

	/**
	 * OpenAI doesn't support OAuth, it uses API keys
	 */
	supportsOAuth(): boolean {
		return false;
	}
}
