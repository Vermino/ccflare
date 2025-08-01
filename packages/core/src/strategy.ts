import { StrategyName } from "@ccflare/types";
import type { Account } from "./types";

// Array of all strategies for backwards compatibility
export const STRATEGIES = StrategyName ? Object.values(StrategyName) : ["session", "round-robin", "least-used", "model-aware", "weighted"];

export function isValidStrategy(strategy: string): strategy is StrategyName {
	return StrategyName ? Object.values(StrategyName).includes(strategy as StrategyName) : ["session", "round-robin", "least-used", "model-aware", "weighted"].includes(strategy);
}

// Default load balancing strategy
export const DEFAULT_STRATEGY = StrategyName?.Session || "session";

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

// Re-export from types package for backwards compatibility
export { StrategyName } from "@ccflare/types";
