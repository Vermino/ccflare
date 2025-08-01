import type {
	Account,
	LoadBalancingStrategy,
	RequestMeta,
	StrategyStore,
} from "@ccflare/core";
import { isAccountAvailable } from "@ccflare/core";
import { Logger } from "@ccflare/logger";
import { StrategyName } from "@ccflare/types";

export class SessionStrategy implements LoadBalancingStrategy {
	private sessionDurationMs: number;
	private store: StrategyStore | null = null;
	private log = new Logger("SessionStrategy");

	constructor(sessionDurationMs: number = 5 * 60 * 60 * 1000) {
		this.sessionDurationMs = sessionDurationMs;
	}

	initialize(store: StrategyStore): void {
		this.store = store;
	}

	private resetSessionIfExpired(account: Account): void {
		const now = Date.now();

		if (
			!account.session_start ||
			now - account.session_start >= this.sessionDurationMs
		) {
			// Reset session
			if (this.store) {
				const wasExpired = account.session_start !== null;
				this.log.info(
					wasExpired
						? `Session expired for account ${account.name}, starting new session`
						: `Starting new session for account ${account.name}`,
				);
				this.store.resetAccountSession(account.id, now);

				// Update the account object to reflect changes
				account.session_start = now;
				account.session_request_count = 0;
			}
		}
	}

	select(accounts: Account[], _meta: RequestMeta): Account[] {
		const now = Date.now();

		// Find account with active session (most recent session_start within window)
		let activeAccount: Account | null = null;
		let mostRecentSessionStart = 0;

		for (const account of accounts) {
			if (
				account.session_start &&
				now - account.session_start < this.sessionDurationMs &&
				account.session_start > mostRecentSessionStart
			) {
				activeAccount = account;
				mostRecentSessionStart = account.session_start;
			}
		}

		// If we have an active account and it's available, use it exclusively
		if (activeAccount && isAccountAvailable(activeAccount, now)) {
			// Reset session if expired (shouldn't happen but just in case)
			this.resetSessionIfExpired(activeAccount);
			this.log.info(
				`Continuing session for account ${activeAccount.name} (${activeAccount.session_request_count} requests in session)`,
			);
			// Return active account first, then others as fallback
			const others = accounts.filter(
				(a) => a.id !== activeAccount.id && isAccountAvailable(a, now),
			);
			return [activeAccount, ...others];
		}

		// No active session or active account is rate limited
		// Filter available accounts
		const available = accounts.filter((a) => isAccountAvailable(a, now));

		if (available.length === 0) return [];

		// Pick the first available account and start a new session with it
		const chosenAccount = available[0];
		this.resetSessionIfExpired(chosenAccount);

		// Return chosen account first, then others as fallback
		const others = available.filter((a) => a.id !== chosenAccount.id);
		return [chosenAccount, ...others];
	}
}

export class RoundRobinStrategy implements LoadBalancingStrategy {
	private store: StrategyStore | null = null;
	private log = new Logger("RoundRobinStrategy");
	private lastUsedIndex = 0;

	initialize(store: StrategyStore): void {
		this.store = store;
	}

	select(accounts: Account[], _meta: RequestMeta): Account[] {
		const now = Date.now();
		const available = accounts.filter((a) => isAccountAvailable(a, now));

		if (available.length === 0) return [];

		// Round-robin selection
		this.lastUsedIndex = (this.lastUsedIndex + 1) % available.length;
		const chosen = available[this.lastUsedIndex];

		this.log.info(`Round-robin selected account ${chosen.name}`);

		// Return chosen account first, others as fallback
		const others = available.filter((a) => a.id !== chosen.id);
		return [chosen, ...others];
	}
}

export class LeastUsedStrategy implements LoadBalancingStrategy {
	private store: StrategyStore | null = null;
	private log = new Logger("LeastUsedStrategy");

	initialize(store: StrategyStore): void {
		this.store = store;
	}

	select(accounts: Account[], _meta: RequestMeta): Account[] {
		const now = Date.now();
		const available = accounts.filter((a) => isAccountAvailable(a, now));

		if (available.length === 0) return [];

		// Sort by total requests (ascending)
		available.sort((a, b) => a.total_requests - b.total_requests);
		const chosen = available[0];

		this.log.info(
			`Least-used selected account ${chosen.name} (${chosen.total_requests} total requests)`,
		);

		// Return sorted list with least used first
		return available;
	}
}

export class ModelAwareStrategy implements LoadBalancingStrategy {
	private store: StrategyStore | null = null;
	private log = new Logger("ModelAwareStrategy");

	initialize(store: StrategyStore): void {
		this.store = store;
	}

	select(accounts: Account[], meta: RequestMeta): Account[] {
		const now = Date.now();
		const available = accounts.filter((a) => isAccountAvailable(a, now));

		if (available.length === 0) return [];

		// For model-aware strategy, prefer accounts based on tier
		// Higher tier accounts get priority for complex models
		const model = meta.model || "claude-3-haiku-20240307";
		const isComplexModel = model.includes("opus") || model.includes("sonnet");

		if (isComplexModel) {
			// Prefer higher tier accounts for complex models
			available.sort((a, b) => b.account_tier - a.account_tier);
		} else {
			// Use lower tier accounts for simple models to preserve high-tier capacity
			available.sort((a, b) => a.account_tier - b.account_tier);
		}

		const chosen = available[0];
		this.log.info(
			`Model-aware selected account ${chosen.name} (tier ${chosen.account_tier}) for model ${model}`,
		);

		return available;
	}
}

export class WeightedStrategy implements LoadBalancingStrategy {
	private store: StrategyStore | null = null;
	private log = new Logger("WeightedStrategy");

	initialize(store: StrategyStore): void {
		this.store = store;
	}

	select(accounts: Account[], _meta: RequestMeta): Account[] {
		const now = Date.now();
		const available = accounts.filter((a) => isAccountAvailable(a, now));

		if (available.length === 0) return [];

		// Weight by account tier (higher tier = higher weight)
		const weights = available.map((a) => a.account_tier * 10);
		const totalWeight = weights.reduce((sum, w) => sum + w, 0);

		// Weighted random selection
		let random = Math.random() * totalWeight;
		let chosenIndex = 0;

		for (let i = 0; i < weights.length; i++) {
			random -= weights[i];
			if (random <= 0) {
				chosenIndex = i;
				break;
			}
		}

		const chosen = available[chosenIndex];
		this.log.info(
			`Weighted selected account ${chosen.name} (tier ${chosen.account_tier})`,
		);

		// Return chosen account first, others as fallback
		const others = available.filter((a) => a.id !== chosen.id);
		return [chosen, ...others];
	}
}

/**
 * Strategy factory to create strategy instances
 */
export function createStrategy(
	strategyName: StrategyName,
	options?: { sessionDurationMs?: number },
): LoadBalancingStrategy {
	switch (strategyName) {
		case StrategyName.Session:
			return new SessionStrategy(options?.sessionDurationMs);
		case StrategyName.RoundRobin:
			return new RoundRobinStrategy();
		case StrategyName.LeastUsed:
			return new LeastUsedStrategy();
		case StrategyName.ModelAware:
			return new ModelAwareStrategy();
		case StrategyName.Weighted:
			return new WeightedStrategy();
		default:
			throw new Error(`Unknown strategy: ${strategyName}`);
	}
}
