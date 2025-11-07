import type { AnalyticsResponse } from "@ccflare/http-api";

export interface Account {
	id: string;
	name: string;
	provider: string;
	requestCount: number;
	totalRequests: number;
	lastUsed: string | null;
	created: string;
	tier: number;
	paused: boolean;
	tokenStatus: string;
	rateLimitStatus: string;
	rateLimitReset: string | null;
	rateLimitRemaining: number | null;
	sessionInfo: string | null;
	// Detailed Anthropic rate limit tracking
	requests_limit: number | null;
	requests_remaining: number | null;
	requests_reset: number | null;
	tokens_limit: number | null;
	tokens_remaining: number | null;
	tokens_reset: number | null;
	input_tokens_limit: number | null;
	input_tokens_remaining: number | null;
	input_tokens_reset: number | null;
	output_tokens_limit: number | null;
	output_tokens_remaining: number | null;
	output_tokens_reset: number | null;
	// Unified 5-hour and 7-day rate limit tracking
	unified_5h_status: string | null;
	unified_5h_reset: number | null;
	unified_7d_status: string | null;
	unified_7d_reset: number | null;
	unified_fallback_percentage: number | null;
	unified_representative_claim: string | null;
	unified_overage_disabled_reason: string | null;
	organization_id: string | null;
}

export interface Stats {
	totalRequests: number;
	successRate: number;
	activeAccounts: number;
	avgResponseTime: number;
	totalTokens: number;
	totalCostUsd: number;
	topModels: Array<{ model: string; count: number }>;
	accounts: Array<{
		name: string;
		requestCount: number;
		successRate: number;
	}>;
	recentErrors: string[];
}

export interface LogEntry {
	ts: number;
	level: string;
	msg: string;
}

export interface RequestPayload {
	id: string;
	request: {
		headers: Record<string, string>;
		body: string | null;
	};
	response: {
		status: number;
		headers: Record<string, string>;
		body: string | null;
	} | null;
	error?: string;
	meta: {
		accountId?: string;
		accountName?: string;
		retry?: number;
		timestamp: number;
		success?: boolean;
		rateLimited?: boolean;
		accountsAttempted?: number;
	};
}

export interface RequestSummary {
	id: string;
	timestamp: string;
	method: string;
	path: string;
	accountUsed: string | null;
	statusCode: number | null;
	success: boolean;
	errorMessage: string | null;
	responseTimeMs: number | null;
	failoverAttempts: number;
	model?: string;
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
	costUsd?: number;
	inputTokens?: number;
	cacheReadInputTokens?: number;
	cacheCreationInputTokens?: number;
	outputTokens?: number;
}

export interface Project {
	id: number;
	name: string;
	path: string;
	claude_file_path: string;
	created_at: string;
	last_activity: string;
	total_sessions: number;
	avg_satisfaction: number;
}

export interface ProjectSession {
	id: number;
	project_id: number;
	user_id: string;
	agent_type: string;
	agent_version: string;
	session_start: string;
	session_end: string;
	request_count: number;
	tools_used: string[];
	task_description: string;
	success_rating: number;
	completion_time_ms: number;
	error_count: number;
}

export interface ProjectDetails {
	project: Project;
	sessions: ProjectSession[];
}

class API {
	private baseUrl = "http://localhost:8081";

	async getStats(): Promise<Stats> {
		const res = await fetch(`${this.baseUrl}/api/stats`);
		if (!res.ok) throw new Error("Failed to fetch stats");
		return res.json() as Promise<Stats>;
	}

	async getAccounts(): Promise<Account[]> {
		const res = await fetch(`${this.baseUrl}/api/accounts`);
		if (!res.ok) throw new Error("Failed to fetch accounts");
		return res.json() as Promise<Account[]>;
	}

	async getAgents(): Promise<any> {
		const res = await fetch(`${this.baseUrl}/api/agents`);
		if (!res.ok) throw new Error("Failed to fetch agents");
		return res.json();
	}

	async initAddAccount(data: {
		name: string;
		mode: "max" | "console";
		tier: number;
	}): Promise<{ authUrl: string; sessionId: string }> {
		const res = await fetch(`${this.baseUrl}/api/accounts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...data, step: "init" }),
		});
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to initialize account");
		}
		const result = (await res.json()) as { authUrl: string };
		return { authUrl: result.authUrl, sessionId: data.name };
	}

	async completeAddAccount(data: {
		sessionId: string;
		code: string;
	}): Promise<{ message: string; mode: string; tier: number }> {
		const res = await fetch(`${this.baseUrl}/api/accounts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: data.sessionId,
				code: data.code,
				step: "callback",
			}),
		});
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to complete account setup");
		}
		return res.json() as Promise<{
			message: string;
			mode: string;
			tier: number;
		}>;
	}

	async addOpenAIAccount(data: {
		name: string;
		apiKey: string;
	}): Promise<{ message: string; provider: string }> {
		const res = await fetch(`${this.baseUrl}/api/accounts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: data.name,
				apiKey: data.apiKey,
				provider: "openai",
			}),
		});
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to add OpenAI account");
		}
		return res.json() as Promise<{
			message: string;
			provider: string;
		}>;
	}

	async removeAccount(name: string, confirm: string): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/accounts/${name}`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ confirm }),
		});
		if (!res.ok) {
			const error = (await res.json()) as {
				error?: string;
				confirmationRequired?: boolean;
			};
			throw new Error(error.error || "Failed to remove account");
		}
	}

	async resetStats(): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/stats/reset`, {
			method: "POST",
		});
		if (!res.ok) throw new Error("Failed to reset stats");
	}

	async getLogHistory(): Promise<LogEntry[]> {
		const res = await fetch(`${this.baseUrl}/api/logs/history`);
		if (!res.ok) throw new Error("Failed to fetch log history");
		return res.json() as Promise<LogEntry[]>;
	}

	streamLogs(onLog: (log: LogEntry) => void): EventSource {
		const eventSource = new EventSource(`${this.baseUrl}/api/logs/stream`);
		eventSource.addEventListener("message", (event) => {
			try {
				const data = JSON.parse(event.data);
				// Skip non-log messages (like the initial "connected" message)
				if (data.ts && data.level && data.msg) {
					onLog(data as LogEntry);
				}
			} catch (e) {
				console.error("Error parsing log event:", e);
			}
		});
		return eventSource;
	}

	async getRequestsDetail(limit = 100): Promise<RequestPayload[]> {
		const res = await fetch(
			`${this.baseUrl}/api/requests/detail?limit=${limit}`,
		);
		if (!res.ok) throw new Error("Failed to fetch detailed requests");
		return res.json() as Promise<RequestPayload[]>;
	}

	async getRequestsSummary(limit = 50): Promise<RequestSummary[]> {
		const res = await fetch(`${this.baseUrl}/api/requests?limit=${limit}`);
		if (!res.ok) throw new Error("Failed to fetch request summaries");
		return res.json() as Promise<RequestSummary[]>;
	}

	async getAnalytics(
		range = "24h",
		filters?: {
			accounts?: string[];
			models?: string[];
			status?: "all" | "success" | "error";
		},
		mode: "normal" | "cumulative" = "normal",
	): Promise<AnalyticsResponse> {
		const params = new URLSearchParams({ range });

		if (filters?.accounts?.length) {
			params.append("accounts", filters.accounts.join(","));
		}
		if (filters?.models?.length) {
			params.append("models", filters.models.join(","));
		}
		if (filters?.status && filters.status !== "all") {
			params.append("status", filters.status);
		}
		if (mode === "cumulative") {
			params.append("mode", "cumulative");
		}

		const res = await fetch(`${this.baseUrl}/api/analytics?${params}`);
		if (!res.ok) throw new Error("Failed to fetch analytics data");
		return res.json() as Promise<AnalyticsResponse>;
	}

	async pauseAccount(accountId: string): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/accounts/${accountId}/pause`, {
			method: "POST",
		});
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to pause account");
		}
	}

	async resumeAccount(accountId: string): Promise<void> {
		const res = await fetch(
			`${this.baseUrl}/api/accounts/${accountId}/resume`,
			{
				method: "POST",
			},
		);
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to resume account");
		}
	}

	async getStrategy(): Promise<string> {
		const res = await fetch(`${this.baseUrl}/api/config/strategy`);
		if (!res.ok) throw new Error("Failed to fetch strategy");
		const data = (await res.json()) as { strategy: string };
		return data.strategy;
	}

	async listStrategies(): Promise<string[]> {
		const res = await fetch(`${this.baseUrl}/api/strategies`);
		if (!res.ok) throw new Error("Failed to list strategies");
		return res.json() as Promise<string[]>;
	}

	async setStrategy(strategy: string): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/config/strategy`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ strategy }),
		});
		if (!res.ok) {
			const error = (await res.json()) as { error?: string };
			throw new Error(error.error || "Failed to set strategy");
		}
	}

	async getProjects(): Promise<Project[]> {
		const res = await fetch(`${this.baseUrl}/api/projects`);
		if (!res.ok) throw new Error("Failed to fetch projects");
		return res.json() as Promise<Project[]>;
	}

	async getProjectDetails(projectId: number): Promise<ProjectDetails> {
		const res = await fetch(`${this.baseUrl}/api/projects/${projectId}`);
		if (!res.ok) throw new Error("Failed to fetch project details");
		return res.json() as Promise<ProjectDetails>;
	}

	async getProjectSessions(projectId: number): Promise<ProjectSession[]> {
		const res = await fetch(
			`${this.baseUrl}/api/projects/${projectId}/sessions`,
		);
		if (!res.ok) throw new Error("Failed to fetch project sessions");
		return res.json() as Promise<ProjectSession[]>;
	}

	async getAllBandwidth(): Promise<any[]> {
		const res = await fetch(`${this.baseUrl}/api/bandwidth`);
		if (!res.ok) throw new Error("Failed to fetch bandwidth data");
		const data = (await res.json()) as { success: boolean; data: any[] };
		return data.data;
	}
}

export const api = new API();
