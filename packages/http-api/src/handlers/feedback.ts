import type { Database } from "bun:sqlite";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import { errorResponse } from "../utils/http-error";

const log = new Logger("FeedbackHandler");

export interface FeedbackSubmission {
	session_id?: number;
	feedback_type: string;
	feedback_data: Record<string, unknown>;
	source?: string;
}

export interface FeedbackSummary {
	total_feedback: number;
	by_type: Record<string, number>;
	by_source: Record<string, number>;
	recent_feedback: Array<{
		id: number;
		feedback_type: string;
		feedback_data: string;
		timestamp: string;
		source: string;
	}>;
}

/**
 * Submit general feedback
 */
export function createFeedbackSubmissionHandler(dbOps: DatabaseOperations) {
	return async (req: Request): Promise<Response> => {
		try {
			const feedback = (await req.json()) as FeedbackSubmission;

			if (!feedback.feedback_type || !feedback.feedback_data) {
				return errorResponse(
					"feedback_type and feedback_data are required",
					400,
				);
			}

			const db = dbOps.getDatabase();
			const stmt = db.prepare(`
				INSERT INTO session_feedback (
					session_id, feedback_type, feedback_data, source
				) VALUES (?, ?, ?, ?)
			`);

			stmt.run(
				feedback.session_id || null,
				feedback.feedback_type,
				JSON.stringify(feedback.feedback_data),
				feedback.source || "user",
			);

			return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to submit feedback:", error);
			return errorResponse("Failed to submit feedback", 500);
		}
	};
}

/**
 * Get feedback analytics summary
 */
export function createFeedbackSummaryHandler(db: Database) {
	return (_req: Request, url: URL): Response => {
		try {
			const days = parseInt(url.searchParams.get("days") || "30");
			const agentType = url.searchParams.get("agent_type");

			let timeFilter = "";
			let agentFilter = "";
			const params: (string | number)[] = [];

			if (days > 0) {
				timeFilter = "AND sf.timestamp >= datetime('now', '-' || ? || ' days')";
				params.push(days);
			}

			if (agentType) {
				agentFilter = `
					AND sf.session_id IN (
						SELECT id FROM agent_sessions WHERE agent_type = ?
					)
				`;
				params.push(agentType);
			}

			// Get total feedback count
			const totalStmt = db.prepare(`
				SELECT COUNT(*) as total 
				FROM session_feedback sf
				WHERE 1=1 ${timeFilter} ${agentFilter}
			`);
			const totalResult = totalStmt.get(...params) as { total: number };

			// Get feedback by type
			const byTypeStmt = db.prepare(`
				SELECT feedback_type, COUNT(*) as count
				FROM session_feedback sf
				WHERE 1=1 ${timeFilter} ${agentFilter}
				GROUP BY feedback_type
				ORDER BY count DESC
			`);
			const byTypeResults = byTypeStmt.all(...params) as Array<{
				feedback_type: string;
				count: number;
			}>;
			const byType = Object.fromEntries(
				byTypeResults.map((r) => [r.feedback_type, r.count]),
			);

			// Get feedback by source
			const bySourceStmt = db.prepare(`
				SELECT source, COUNT(*) as count
				FROM session_feedback sf
				WHERE 1=1 ${timeFilter} ${agentFilter}
				GROUP BY source
				ORDER BY count DESC
			`);
			const bySourceResults = bySourceStmt.all(...params) as Array<{
				source: string;
				count: number;
			}>;
			const bySource = Object.fromEntries(
				bySourceResults.map((r) => [r.source, r.count]),
			);

			// Get recent feedback
			const recentStmt = db.prepare(`
				SELECT id, feedback_type, feedback_data, timestamp, source
				FROM session_feedback sf
				WHERE 1=1 ${timeFilter} ${agentFilter}
				ORDER BY timestamp DESC
				LIMIT 20
			`);
			const recentFeedback = recentStmt.all(...params) as Array<{
				id: number;
				feedback_type: string;
				feedback_data: string;
				timestamp: string;
				source: string;
			}>;

			const summary: FeedbackSummary = {
				total_feedback: totalResult.total,
				by_type: byType,
				by_source: bySource,
				recent_feedback: recentFeedback,
			};

			return new Response(JSON.stringify(summary), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to get feedback summary:", error);
			return errorResponse("Failed to get feedback summary", 500);
		}
	};
}
