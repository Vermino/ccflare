import type { Database } from "bun:sqlite";
import { validateNumber } from "@ccflare/core";
import {
	createAccountAddHandler,
	createAccountPauseHandler,
	createAccountRemoveHandler,
	createAccountRenameHandler,
	createAccountResumeHandler,
	createAccountsListHandler,
	createAccountTierUpdateHandler,
} from "./handlers/accounts";
import {
	createAgentVersionCreateHandler,
	createAgentVersionRollbackHandler,
	createAgentVersionsListHandler,
	createAgentVersionUpdateHandler,
} from "./handlers/agent-versions";
import {
	createAgentPreferenceUpdateHandler,
	createAgentsListHandler,
	createBulkAgentPreferenceUpdateHandler,
	createWorkspacesListHandler,
} from "./handlers/agents";
import { createAgentUpdateHandler } from "./handlers/agents-update";
import { createAnalyticsHandler } from "./handlers/analytics";
import { createBandwidthHandler } from "./handlers/bandwidth";
import { handleClaudeUsage } from "./handlers/claude-usage";
import { createConfigHandlers } from "./handlers/config";
import {
	createFeedbackSubmissionHandler,
	createFeedbackSummaryHandler,
} from "./handlers/feedback";
import { createHealthHandler } from "./handlers/health";
import { createLogsStreamHandler } from "./handlers/logs";
import { createLogsHistoryHandler } from "./handlers/logs-history";
import {
	createOAuthCallbackHandler,
	createOAuthInitHandler,
} from "./handlers/oauth";
import {
	createPerformanceReviewsListHandler,
	createReviewResponseHandler,
	createReviewTriggerHandler,
} from "./handlers/performance-reviews";
import {
	createProjectDetailHandler,
	createProjectFeedbackHandler,
	createProjectSessionsHandler,
	createProjectsListHandler,
} from "./handlers/projects";
import {
	createRequestsDetailHandler,
	createRequestsSummaryHandler,
} from "./handlers/requests";
import { createRequestsStreamHandler } from "./handlers/requests-stream";
import { createStatsHandler, createStatsResetHandler } from "./handlers/stats";
import type { APIContext } from "./types";
import { errorResponse } from "./utils/http-error";

/**
 * API Router that handles all API endpoints
 */
export class APIRouter {
	private context: APIContext;
	private handlers: Map<
		string,
		(req: Request, url: URL) => Response | Promise<Response>
	>;

	constructor(context: APIContext) {
		this.context = context;
		this.handlers = new Map();
		this.registerHandlers();
	}

	private registerHandlers(): void {
		const { db, config, dbOps } = this.context;

		// Create handlers
		const healthHandler = createHealthHandler(db, config);
		const statsHandler = createStatsHandler(db as Database);
		const statsResetHandler = createStatsResetHandler(dbOps);
		const accountsHandler = createAccountsListHandler(db);
		const accountAddHandler = createAccountAddHandler(dbOps, config);
		const _accountRemoveHandler = createAccountRemoveHandler(dbOps);
		const _accountTierHandler = createAccountTierUpdateHandler(dbOps);
		const requestsSummaryHandler = createRequestsSummaryHandler(db);
		const requestsDetailHandler = createRequestsDetailHandler(dbOps);
		const configHandlers = createConfigHandlers(config);
		const logsStreamHandler = createLogsStreamHandler();
		const logsHistoryHandler = createLogsHistoryHandler();
		const analyticsHandler = createAnalyticsHandler(this.context);
		const bandwidthHandler = createBandwidthHandler(db);
		const oauthInitHandler = createOAuthInitHandler(dbOps);
		const oauthCallbackHandler = createOAuthCallbackHandler(dbOps);
		const agentsHandler = createAgentsListHandler(dbOps);
		const workspacesHandler = createWorkspacesListHandler();
		const requestsStreamHandler = createRequestsStreamHandler();

		// Feedback system handlers
		const projectsListHandler = createProjectsListHandler(db);
		const _projectDetailHandler = createProjectDetailHandler(db);
		const _projectFeedbackHandler = createProjectFeedbackHandler(dbOps);
		const _projectSessionsHandler = createProjectSessionsHandler(db);
		const feedbackSubmissionHandler = createFeedbackSubmissionHandler(dbOps);
		const feedbackSummaryHandler = createFeedbackSummaryHandler(db);
		const agentVersionsListHandler = createAgentVersionsListHandler(db);
		const agentVersionCreateHandler = createAgentVersionCreateHandler(dbOps);
		const _agentVersionUpdateHandler = createAgentVersionUpdateHandler(dbOps);
		const _agentVersionRollbackHandler =
			createAgentVersionRollbackHandler(dbOps);
		const performanceReviewsListHandler =
			createPerformanceReviewsListHandler(db);
		const reviewTriggerHandler = createReviewTriggerHandler(dbOps);
		const _reviewResponseHandler = createReviewResponseHandler(dbOps);

		// Register routes
		this.handlers.set("GET:/health", () => healthHandler());
		this.handlers.set("GET:/api/stats", () => statsHandler());
		this.handlers.set("POST:/api/stats/reset", () => statsResetHandler());
		this.handlers.set("GET:/api/accounts", () => accountsHandler());
		this.handlers.set("POST:/api/accounts", (req) => accountAddHandler(req));
		this.handlers.set("POST:/api/oauth/init", (req) => oauthInitHandler(req));
		this.handlers.set("POST:/api/oauth/callback", (req) =>
			oauthCallbackHandler(req),
		);
		this.handlers.set("GET:/api/requests", (_req, url) => {
			const limitParam = url.searchParams.get("limit");
			const limit =
				validateNumber(limitParam || "50", "limit", {
					min: 1,
					max: 1000,
					integer: true,
				}) || 50;
			return requestsSummaryHandler(limit);
		});
		this.handlers.set("GET:/api/requests/detail", (_req, url) => {
			const limitParam = url.searchParams.get("limit");
			const limit =
				validateNumber(limitParam || "100", "limit", {
					min: 1,
					max: 1000,
					integer: true,
				}) || 100;
			return requestsDetailHandler(limit);
		});
		this.handlers.set("GET:/api/requests/stream", () =>
			requestsStreamHandler(),
		);
		this.handlers.set("GET:/api/config", () => configHandlers.getConfig());
		this.handlers.set("GET:/api/config/strategy", () =>
			configHandlers.getStrategy(),
		);
		this.handlers.set("POST:/api/config/strategy", (req) =>
			configHandlers.setStrategy(req),
		);
		this.handlers.set("GET:/api/strategies", () =>
			configHandlers.getStrategies(),
		);
		this.handlers.set("GET:/api/config/model", () =>
			configHandlers.getDefaultAgentModel(),
		);
		this.handlers.set("POST:/api/config/model", (req) =>
			configHandlers.setDefaultAgentModel(req),
		);
		this.handlers.set("GET:/api/logs/stream", () => logsStreamHandler());
		this.handlers.set("GET:/api/logs/history", () => logsHistoryHandler());
		this.handlers.set("GET:/api/analytics", (_req, url) => {
			return analyticsHandler(url.searchParams);
		});
		this.handlers.set("GET:/api/bandwidth", () =>
			bandwidthHandler.getAllBandwidth(),
		);
		this.handlers.set("GET:/api/bandwidth/summary", () =>
			bandwidthHandler.getBandwidthSummary(),
		);
		this.handlers.set("GET:/api/claude/usage", () =>
			handleClaudeUsage(db as Database),
		);
		this.handlers.set("GET:/api/agents", () => agentsHandler());
		this.handlers.set("POST:/api/agents/bulk-preference", (req) => {
			const bulkHandler = createBulkAgentPreferenceUpdateHandler(
				this.context.dbOps,
			);
			return bulkHandler(req);
		});
		this.handlers.set("GET:/api/workspaces", () => workspacesHandler());

		// Feedback system routes - basic endpoints
		this.handlers.set("GET:/api/projects", () => projectsListHandler());
		this.handlers.set("POST:/api/feedback", (req) =>
			feedbackSubmissionHandler(req),
		);
		this.handlers.set("GET:/api/feedback/summary", (_req, url) =>
			feedbackSummaryHandler(_req, url),
		);
		this.handlers.set("GET:/api/agents/versions", (_req, url) =>
			agentVersionsListHandler(_req, url),
		);
		this.handlers.set("POST:/api/agents/versions", (req) =>
			agentVersionCreateHandler(req),
		);
		this.handlers.set("GET:/api/reviews", (_req, url) =>
			performanceReviewsListHandler(_req, url),
		);
		this.handlers.set("POST:/api/reviews/trigger", (req) =>
			reviewTriggerHandler(req),
		);
	}

	/**
	 * Wrap a handler with error handling and CORS headers
	 */
	private wrapHandler(
		handler: (req: Request, url: URL) => Response | Promise<Response>,
	): (req: Request, url: URL) => Promise<Response> {
		return async (req: Request, url: URL) => {
			try {
				const response = await handler(req, url);

				// Add CORS headers
				const corsHeaders = new Headers(response.headers);
				corsHeaders.set("Access-Control-Allow-Origin", "*");
				corsHeaders.set(
					"Access-Control-Allow-Methods",
					"GET, POST, PUT, DELETE, OPTIONS",
				);
				corsHeaders.set(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization",
				);

				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: corsHeaders,
				});
			} catch (error) {
				const errorResp = errorResponse(error);

				// Add CORS headers to error responses too
				const corsHeaders = new Headers(errorResp.headers);
				corsHeaders.set("Access-Control-Allow-Origin", "*");
				corsHeaders.set(
					"Access-Control-Allow-Methods",
					"GET, POST, PUT, DELETE, OPTIONS",
				);
				corsHeaders.set(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization",
				);

				return new Response(errorResp.body, {
					status: errorResp.status,
					statusText: errorResp.statusText,
					headers: corsHeaders,
				});
			}
		};
	}

	/**
	 * Handle an incoming request
	 */
	async handleRequest(url: URL, req: Request): Promise<Response | null> {
		const path = url.pathname;
		const method = req.method;
		const key = `${method}:${path}`;

		// Handle CORS preflight requests
		if (method === "OPTIONS") {
			return new Response(null, {
				status: 200,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Check for exact match
		const handler = this.handlers.get(key);
		if (handler) {
			return await this.wrapHandler(handler)(req, url);
		}

		// Check for dynamic account endpoints
		if (path.startsWith("/api/accounts/")) {
			const parts = path.split("/");
			const accountId = parts[3];

			// Account tier update
			if (path.endsWith("/tier") && method === "POST") {
				const tierHandler = createAccountTierUpdateHandler(this.context.dbOps);
				return await this.wrapHandler((req) => tierHandler(req, accountId))(
					req,
					url,
				);
			}

			// Account pause
			if (path.endsWith("/pause") && method === "POST") {
				const pauseHandler = createAccountPauseHandler(this.context.dbOps);
				return await this.wrapHandler((req) => pauseHandler(req, accountId))(
					req,
					url,
				);
			}

			// Account resume
			if (path.endsWith("/resume") && method === "POST") {
				const resumeHandler = createAccountResumeHandler(this.context.dbOps);
				return await this.wrapHandler((req) => resumeHandler(req, accountId))(
					req,
					url,
				);
			}

			// Account rename
			if (path.endsWith("/rename") && method === "POST") {
				const renameHandler = createAccountRenameHandler(this.context.dbOps);
				return await this.wrapHandler((req) => renameHandler(req, accountId))(
					req,
					url,
				);
			}

			// Account removal
			if (parts.length === 4 && method === "DELETE") {
				const removeHandler = createAccountRemoveHandler(this.context.dbOps);
				return await this.wrapHandler((req) => removeHandler(req, accountId))(
					req,
					url,
				);
			}
		}

		// Check for dynamic bandwidth endpoints
		if (
			path.startsWith("/api/bandwidth/") &&
			path !== "/api/bandwidth/summary"
		) {
			const parts = path.split("/");
			const accountId = parts[3];

			// Individual account bandwidth
			if (parts.length === 4 && method === "GET") {
				const dynamicBandwidthHandler = createBandwidthHandler(
					this.context.db as Database,
				);
				return await this.wrapHandler((req) =>
					dynamicBandwidthHandler.getBandwidth(req, accountId),
				)(req, url);
			}
		}

		// Check for dynamic agent endpoints
		if (path.startsWith("/api/agents/")) {
			const parts = path.split("/");
			const agentId = parts[3];

			// Agent preference update
			if (path.endsWith("/preference") && method === "POST") {
				const preferenceHandler = createAgentPreferenceUpdateHandler(
					this.context.dbOps,
				);
				return await this.wrapHandler((req) => preferenceHandler(req, agentId))(
					req,
					url,
				);
			}

			// Agent update (PATCH /api/agents/:id)
			if (parts.length === 4 && method === "PATCH") {
				const updateHandler = createAgentUpdateHandler(this.context.dbOps);
				return await this.wrapHandler((req) => updateHandler(req, agentId))(
					req,
					url,
				);
			}
		}

		// Check for dynamic project endpoints
		if (path.startsWith("/api/projects/")) {
			const parts = path.split("/");
			const _projectId = parts[3];

			// Project detail (GET /api/projects/:id)
			if (parts.length === 4 && method === "GET") {
				const handler = createProjectDetailHandler(this.context.db as Database);
				return await this.wrapHandler((_req, url) => handler(_req, url))(
					req,
					url,
				);
			}

			// Project feedback (POST /api/projects/:id/feedback)
			if (path.endsWith("/feedback") && method === "POST") {
				const handler = createProjectFeedbackHandler(this.context.dbOps);
				return await this.wrapHandler((req, url) => handler(req, url))(
					req,
					url,
				);
			}

			// Project sessions (GET /api/projects/:id/sessions)
			if (path.endsWith("/sessions") && method === "GET") {
				const handler = createProjectSessionsHandler(
					this.context.db as Database,
				);
				return await this.wrapHandler((_req, url) => handler(_req, url))(
					req,
					url,
				);
			}
		}

		// Check for dynamic agent version endpoints
		if (path.startsWith("/api/agents/versions/")) {
			const parts = path.split("/");
			const _versionId = parts[4];

			// Version update (PUT /api/agents/versions/:id)
			if (parts.length === 5 && method === "PUT") {
				const handler = createAgentVersionUpdateHandler(this.context.dbOps);
				return await this.wrapHandler((req, url) => handler(req, url))(
					req,
					url,
				);
			}

			// Version rollback (DELETE /api/agents/versions/:id)
			if (parts.length === 5 && method === "DELETE") {
				const handler = createAgentVersionRollbackHandler(this.context.dbOps);
				return await this.wrapHandler((req, url) => handler(req, url))(
					req,
					url,
				);
			}
		}

		// Check for dynamic review endpoints
		if (path.startsWith("/api/reviews/")) {
			const parts = path.split("/");
			const _reviewId = parts[3];

			// Review response (PUT /api/reviews/:id/response)
			if (path.endsWith("/response") && method === "PUT") {
				const handler = createReviewResponseHandler(this.context.dbOps);
				return await this.wrapHandler((req, url) => handler(req, url))(
					req,
					url,
				);
			}
		}

		// No matching route
		return null;
	}
}
