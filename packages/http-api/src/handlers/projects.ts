import type { Database } from "bun:sqlite";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import { errorResponse } from "../utils/http-error";

const log = new Logger("ProjectsHandler");

export interface Project {
	id: number;
	name: string;
	path: string;
	claude_file_path?: string;
	created_at: string;
	last_activity?: string;
	total_sessions: number;
	avg_satisfaction: number;
}

export interface ProjectSession {
	id: number;
	project_id: number;
	user_id?: string;
	agent_type: string;
	agent_version: string;
	session_start: string;
	session_end?: string;
	request_count: number;
	tools_used?: string;
	task_description?: string;
	success_rating?: number;
	completion_time_ms?: number;
	error_count: number;
}

export interface ProjectFeedback {
	feedback_type: string;
	feedback_data: Record<string, unknown>;
	source?: string;
}

/**
 * Get all tracked projects
 */
export function createProjectsListHandler(db: Database) {
	return (): Response => {
		try {
			const stmt = db.prepare(`
				SELECT 
					id, name, path, claude_file_path, created_at, 
					last_activity, total_sessions, avg_satisfaction
				FROM projects 
				ORDER BY last_activity DESC, created_at DESC
			`);

			const projects = stmt.all() as Project[];

			return new Response(JSON.stringify(projects), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to fetch projects:", error);
			return errorResponse("Failed to fetch projects", 500);
		}
	};
}

/**
 * Get specific project details with sessions
 */
export function createProjectDetailHandler(db: Database) {
	return (_req: Request, url: URL): Response => {
		try {
			const pathParts = url.pathname.split("/");
			const projectId = pathParts[pathParts.length - 1];

			if (!projectId || projectId === "projects") {
				return errorResponse("Project ID is required", 400);
			}

			// Get project details
			const projectStmt = db.prepare(`
				SELECT 
					id, name, path, claude_file_path, created_at, 
					last_activity, total_sessions, avg_satisfaction
				FROM projects 
				WHERE id = ?
			`);

			const project = projectStmt.get(projectId) as Project | undefined;

			if (!project) {
				return errorResponse("Project not found", 404);
			}

			// Get recent sessions
			const sessionsStmt = db.prepare(`
				SELECT 
					id, project_id, user_id, agent_type, agent_version,
					session_start, session_end, request_count, tools_used,
					task_description, success_rating, completion_time_ms, error_count
				FROM agent_sessions 
				WHERE project_id = ?
				ORDER BY session_start DESC
				LIMIT 20
			`);

			const sessions = sessionsStmt.all(projectId) as ProjectSession[];

			// Parse JSON fields
			const parsedSessions = sessions.map((session) => ({
				...session,
				tools_used: session.tools_used ? JSON.parse(session.tools_used) : null,
			}));

			const result = {
				project,
				sessions: parsedSessions,
			};

			return new Response(JSON.stringify(result), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to get project details:", error);
			return errorResponse("Failed to get project details", 500);
		}
	};
}

/**
 * Submit feedback for a project
 */
export function createProjectFeedbackHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL): Promise<Response> => {
		try {
			const pathParts = url.pathname.split("/");
			const projectId = pathParts[pathParts.indexOf("projects") + 1];

			if (!projectId) {
				return errorResponse("Project ID is required", 400);
			}

			const feedbackRequest = (await req.json()) as ProjectFeedback;

			if (!feedbackRequest.feedback_type || !feedbackRequest.feedback_data) {
				return errorResponse(
					"feedback_type and feedback_data are required",
					400,
				);
			}

			// For now, we'll store project feedback as a session feedback with project context
			// In a more complete implementation, you might want a separate project_feedback table
			const db = dbOps.getDatabase();
			const stmt = db.prepare(`
				INSERT INTO session_feedback (
					session_id, feedback_type, feedback_data, source
				) VALUES (NULL, ?, ?, ?)
			`);

			const feedbackData = {
				...feedbackRequest.feedback_data,
				project_id: parseInt(projectId),
			};

			stmt.run(
				feedbackRequest.feedback_type,
				JSON.stringify(feedbackData),
				feedbackRequest.source || "user",
			);

			return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to submit project feedback:", error);
			return errorResponse("Failed to submit project feedback", 500);
		}
	};
}

/**
 * Get project sessions with filtering
 */
export function createProjectSessionsHandler(db: Database) {
	return (_req: Request, url: URL): Response => {
		try {
			const pathParts = url.pathname.split("/");
			const projectId = pathParts[pathParts.indexOf("projects") + 1];

			if (!projectId) {
				return errorResponse("Project ID is required", 400);
			}

			const limit = parseInt(url.searchParams.get("limit") || "50");
			const offset = parseInt(url.searchParams.get("offset") || "0");
			const agentType = url.searchParams.get("agent_type");

			let whereClause = "WHERE project_id = ?";
			const params: (string | number)[] = [parseInt(projectId)];

			if (agentType) {
				whereClause += " AND agent_type = ?";
				params.push(agentType);
			}

			const stmt = db.prepare(`
				SELECT 
					id, project_id, user_id, agent_type, agent_version,
					session_start, session_end, request_count, tools_used,
					task_description, success_rating, completion_time_ms, error_count
				FROM agent_sessions 
				${whereClause}
				ORDER BY session_start DESC
				LIMIT ? OFFSET ?
			`);

			params.push(limit, offset);
			const sessions = stmt.all(...params) as ProjectSession[];

			// Parse JSON fields
			const parsedSessions = sessions.map((session) => ({
				...session,
				tools_used: session.tools_used ? JSON.parse(session.tools_used) : null,
			}));

			return new Response(JSON.stringify(parsedSessions), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to get project sessions:", error);
			return errorResponse("Failed to get project sessions", 500);
		}
	};
}
