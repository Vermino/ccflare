import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import type { ProxyContext } from "../proxy";

const log = new Logger("FeedbackMiddleware");

export interface AgentSessionData {
	agent_type?: string;
	agent_version?: string;
	tools_used?: string[];
	task_description?: string;
	project_path?: string;
	user_id?: string;
}

export interface SessionFeedbackData {
	session_id?: number;
	success_rating?: number;
	completion_time_ms?: number;
	error_count?: number;
	feedback_type?: string;
	feedback_data?: Record<string, unknown>;
}

/**
 * Extract agent information from Claude Code request
 */
export function extractAgentInfo(
	requestHeaders: Headers,
	requestBody: ArrayBuffer | null,
): AgentSessionData {
	const sessionData: AgentSessionData = {};

	try {
		// Check for Claude Code specific headers
		const userAgent = requestHeaders.get("user-agent") || "";
		const clientId = requestHeaders.get("x-client-id");
		const agentType = requestHeaders.get("x-agent-type");
		const agentVersion = requestHeaders.get("x-agent-version");
		const projectPath = requestHeaders.get("x-project-path");

		// Extract from headers if available
		if (agentType) sessionData.agent_type = agentType;
		if (agentVersion) sessionData.agent_version = agentVersion;
		if (projectPath) sessionData.project_path = projectPath;
		if (clientId) sessionData.user_id = clientId;

		// Parse request body for Claude Code patterns
		if (requestBody) {
			const bodyText = new TextDecoder().decode(requestBody);

			try {
				const parsedBody = JSON.parse(bodyText);

				// Look for system prompts that indicate agent usage
				if (parsedBody.messages) {
					const systemMessage = parsedBody.messages.find(
						(msg: any) => msg.role === "system",
					);

					if (systemMessage?.content) {
						// Try to identify agent type from system prompt
						sessionData.agent_type = identifyAgentFromPrompt(
							systemMessage.content,
						);
					}
				}

				// Look for tool use patterns
				if (parsedBody.tools) {
					sessionData.tools_used = parsedBody.tools.map(
						(tool: any) => tool.name,
					);
				}

				// Extract task description from user messages
				if (parsedBody.messages) {
					const userMessages = parsedBody.messages
						.filter((msg: any) => msg.role === "user")
						.map((msg: any) => msg.content)
						.join(" ");

					if (userMessages.length > 0) {
						// Extract first 200 characters as task description
						sessionData.task_description = userMessages.substring(0, 200);
					}
				}
			} catch (parseError) {
				// Not JSON or parsing failed, skip body analysis
				log.debug("Failed to parse request body for agent info:", parseError);
			}
		}

		// Fallback detection from User-Agent
		if (!sessionData.agent_type && userAgent.includes("claude-code")) {
			sessionData.agent_type = "general-purpose";
			sessionData.agent_version = "v1.0";
		}
	} catch (error) {
		log.error("Error extracting agent info:", error);
	}

	return sessionData;
}

/**
 * Identify agent type from system prompt patterns
 */
function identifyAgentFromPrompt(systemPrompt: string): string {
	const prompt = systemPrompt.toLowerCase();

	// Check for specific agent patterns
	if (
		prompt.includes("project discovery") ||
		prompt.includes("scan filesystem")
	) {
		return "project-discovery";
	}
	if (
		prompt.includes("session analytics") ||
		prompt.includes("performance metrics")
	) {
		return "session-analytics";
	}
	if (
		prompt.includes("performance reviewer") ||
		prompt.includes("improvement strategies")
	) {
		return "llm-performance-reviewer";
	}
	if (
		prompt.includes("version management") ||
		prompt.includes("deployment orchestration")
	) {
		return "version-management";
	}
	if (
		prompt.includes("feedback aggregation") ||
		prompt.includes("sentiment analysis")
	) {
		return "feedback-aggregation";
	}
	if (prompt.includes("vault analyzer") || prompt.includes("knowledge graph")) {
		return "vault-analyzer";
	}
	if (
		prompt.includes("research specialist") ||
		prompt.includes("comprehensive research")
	) {
		return "research-specialist";
	}
	if (
		prompt.includes("documentation writer") ||
		prompt.includes("markdown documents")
	) {
		return "documentation-writer";
	}

	// Default to general-purpose
	return "general-purpose";
}

/**
 * Start a new agent session
 */
export async function startAgentSession(
	sessionData: AgentSessionData,
	dbOps: DatabaseOperations,
): Promise<number | null> {
	try {
		if (!sessionData.agent_type) {
			return null; // Not an agent request
		}

		const db = dbOps.getDatabase();

		// Find or create project if project_path is available
		let projectId: number | null = null;
		if (sessionData.project_path) {
			// Try to find existing project
			const existingProject = db
				.prepare(`
				SELECT id FROM projects WHERE path = ?
			`)
				.get(sessionData.project_path) as { id: number } | undefined;

			if (existingProject) {
				projectId = existingProject.id;

				// Update last activity
				db.prepare(`
					UPDATE projects 
					SET last_activity = CURRENT_TIMESTAMP,
					    total_sessions = total_sessions + 1
					WHERE id = ?
				`).run(projectId);
			} else {
				// Create new project
				const projectName =
					sessionData.project_path.split("/").pop() || "Unknown Project";
				const result = db
					.prepare(`
					INSERT INTO projects (name, path, last_activity, total_sessions)
					VALUES (?, ?, CURRENT_TIMESTAMP, 1)
				`)
					.run(projectName, sessionData.project_path);

				projectId = result.lastInsertRowid as number;
			}
		}

		// Create agent session
		const sessionResult = db
			.prepare(`
			INSERT INTO agent_sessions (
				project_id, user_id, agent_type, agent_version,
				tools_used, task_description, request_count
			) VALUES (?, ?, ?, ?, ?, ?, 1)
		`)
			.run(
				projectId,
				sessionData.user_id || "anonymous",
				sessionData.agent_type,
				sessionData.agent_version || "v1.0",
				sessionData.tools_used ? JSON.stringify(sessionData.tools_used) : null,
				sessionData.task_description || null,
			);

		const sessionId = sessionResult.lastInsertRowid as number;
		log.info(
			`Started agent session ${sessionId} for ${sessionData.agent_type}`,
		);

		return sessionId;
	} catch (error) {
		log.error("Failed to start agent session:", error);
		return null;
	}
}

/**
 * Complete an agent session with results
 */
export async function completeAgentSession(
	sessionId: number,
	feedbackData: SessionFeedbackData,
	dbOps: DatabaseOperations,
): Promise<void> {
	try {
		const db = dbOps.getDatabase();

		// Update session with completion data
		const updateFields: string[] = [];
		const params: unknown[] = [];

		updateFields.push("session_end = CURRENT_TIMESTAMP");

		if (feedbackData.completion_time_ms !== undefined) {
			updateFields.push("completion_time_ms = ?");
			params.push(feedbackData.completion_time_ms);
		}

		if (feedbackData.success_rating !== undefined) {
			updateFields.push("success_rating = ?");
			params.push(feedbackData.success_rating);
		}

		if (feedbackData.error_count !== undefined) {
			updateFields.push("error_count = ?");
			params.push(feedbackData.error_count);
		}

		params.push(sessionId);

		db.prepare(`
			UPDATE agent_sessions 
			SET ${updateFields.join(", ")}
			WHERE id = ?
		`).run(...(params as any[]));

		// Add feedback if provided
		if (feedbackData.feedback_type && feedbackData.feedback_data) {
			db.prepare(`
				INSERT INTO session_feedback (
					session_id, feedback_type, feedback_data, source
				) VALUES (?, ?, ?, 'system')
			`).run(
				sessionId,
				feedbackData.feedback_type,
				JSON.stringify(feedbackData.feedback_data),
			);
		}

		log.info(`Completed agent session ${sessionId}`);
	} catch (error) {
		log.error("Failed to complete agent session:", error);
	}
}

/**
 * Extract performance metrics from response
 */
export function extractPerformanceMetrics(
	response: Response,
	requestTimestamp: number,
): SessionFeedbackData {
	const completionTime = Date.now() - requestTimestamp;

	const metrics: SessionFeedbackData = {
		completion_time_ms: completionTime,
		error_count: response.ok ? 0 : 1,
	};

	// Analyze response for success indicators
	if (response.ok) {
		// Simple success rating based on response time
		if (completionTime < 5000) {
			metrics.success_rating = 5; // Fast response
		} else if (completionTime < 15000) {
			metrics.success_rating = 4; // Good response
		} else if (completionTime < 30000) {
			metrics.success_rating = 3; // Acceptable response
		} else {
			metrics.success_rating = 2; // Slow response
		}
	} else {
		metrics.success_rating = 1; // Failed response
	}

	return metrics;
}

/**
 * Middleware function to be integrated into proxy handler
 */
export class FeedbackMiddleware {
	private sessions: Map<string, { sessionId: number; startTime: number }> =
		new Map();

	async onRequest(
		requestId: string,
		requestHeaders: Headers,
		requestBody: ArrayBuffer | null,
		ctx: ProxyContext,
	): Promise<void> {
		const sessionData = extractAgentInfo(requestHeaders, requestBody);

		if (sessionData.agent_type) {
			const sessionId = await startAgentSession(sessionData, ctx.dbOps);

			if (sessionId) {
				this.sessions.set(requestId, {
					sessionId,
					startTime: Date.now(),
				});
			}
		}
	}

	async onResponse(
		requestId: string,
		response: Response,
		ctx: ProxyContext,
	): Promise<void> {
		const sessionInfo = this.sessions.get(requestId);

		if (sessionInfo) {
			const metrics = extractPerformanceMetrics(
				response,
				sessionInfo.startTime,
			);

			await completeAgentSession(sessionInfo.sessionId, metrics, ctx.dbOps);

			// Clean up
			this.sessions.delete(requestId);
		}
	}
}

// Export singleton instance
export const feedbackMiddleware = new FeedbackMiddleware();
