import type { StrategyName } from "@ccflare/types";
import type { Account } from "./types";

// Array of all strategies for backwards compatibility
export const STRATEGIES = [
	"session",
	"round-robin",
	"least-used",
	"model-aware",
	"weighted",
];

export function isValidStrategy(strategy: string): strategy is StrategyName {
	return STRATEGIES.includes(strategy);
}

// Default load balancing strategy
export const DEFAULT_STRATEGY = "session";

// Helper to check if an account is available (not rate-limited or paused)
export function isAccountAvailable(
	account: Account,
	now = Date.now(),
): boolean {
	return (
		!account.paused &&
		(!account.rate_limited_until || account.rate_limited_until < now)
	);
}

// Note: StrategyName enum available via direct import from @ccflare/types
