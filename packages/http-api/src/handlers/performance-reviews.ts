import type { Database } from "bun:sqlite";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import { errorResponse } from "../utils/http-error";

const log = new Logger("PerformanceReviewsHandler");

export interface PerformanceReview {
	id: number;
	agent_type: string;
	current_version: string;
	review_period_start?: string;
	review_period_end?: string;
	sessions_analyzed: number;
	review_summary?: string;
	suggested_improvements?: string;
	new_version_proposed?: string;
	user_response?: string;
	created_at: string;
}

export interface ReviewTriggerRequest {
	agent_type: string;
	current_version: string;
	review_period_start?: string;
	review_period_end?: string;
	force?: boolean;
}

export interface ReviewResponseRequest {
	user_response: "accepted" | "rejected" | "pending";
	notes?: string;
}

/**
 * List pending and recent reviews
 */
export function createPerformanceReviewsListHandler(db: Database) {
	return (_req: Request, url: URL): Response => {
		try {
			const status = url.searchParams.get("status"); // pending, accepted, rejected
			const agentType = url.searchParams.get("agent_type");
			const limit = parseInt(url.searchParams.get("limit") || "20");

			let whereClause = "WHERE 1=1";
			const params: (string | number)[] = [];

			if (status) {
				if (status === "pending") {
					whereClause +=
						" AND (user_response IS NULL OR user_response = 'pending')";
				} else {
					whereClause += " AND user_response = ?";
					params.push(status);
				}
			}

			if (agentType) {
				whereClause += " AND agent_type = ?";
				params.push(agentType);
			}

			params.push(limit);

			const stmt = db.prepare(`
				SELECT 
					id, agent_type, current_version, review_period_start,
					review_period_end, sessions_analyzed, review_summary,
					suggested_improvements, new_version_proposed, user_response, created_at
				FROM performance_reviews 
				${whereClause}
				ORDER BY created_at DESC
				LIMIT ?
			`);

			const reviews = stmt.all(...params) as PerformanceReview[];

			// Parse JSON fields
			const parsedReviews = reviews.map((review) => ({
				...review,
				review_summary: review.review_summary
					? JSON.parse(review.review_summary)
					: null,
				suggested_improvements: review.suggested_improvements
					? JSON.parse(review.suggested_improvements)
					: null,
			}));

			return new Response(JSON.stringify(parsedReviews), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to list performance reviews:", error);
			return errorResponse("Failed to list performance reviews", 500);
		}
	};
}

/**
 * Manually trigger a performance review
 */
export function createReviewTriggerHandler(dbOps: DatabaseOperations) {
	return async (req: Request): Promise<Response> => {
		try {
			const triggerData = (await req.json()) as ReviewTriggerRequest;

			if (!triggerData.agent_type || !triggerData.current_version) {
				return errorResponse(
					"agent_type and current_version are required",
					400,
				);
			}

			const db = dbOps.getDatabase();

			// Check if there's already a pending review for this agent
			if (!triggerData.force) {
				const existingStmt = db.prepare(`
					SELECT COUNT(*) as count
					FROM performance_reviews
					WHERE agent_type = ? AND (user_response IS NULL OR user_response = 'pending')
				`);
				const existing = existingStmt.get(triggerData.agent_type) as {
					count: number;
				};

				if (existing.count > 0) {
					return errorResponse(
						"A pending review already exists for this agent type",
						409,
					);
				}
			}

			// Create a placeholder review that will be populated by the review agent
			const stmt = db.prepare(`
				INSERT INTO performance_reviews (
					agent_type, current_version, review_period_start, 
					review_period_end, sessions_analyzed, user_response
				) VALUES (?, ?, ?, ?, 0, 'pending')
			`);

			const periodStart =
				triggerData.review_period_start ||
				new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
			const periodEnd =
				triggerData.review_period_end || new Date().toISOString();

			const result = stmt.run(
				triggerData.agent_type,
				triggerData.current_version,
				periodStart,
				periodEnd,
			);

			// In a real implementation, this would trigger the LLM Performance Reviewer agent
			log.info(
				`Triggered performance review for ${triggerData.agent_type} v${triggerData.current_version}`,
			);

			return new Response(
				JSON.stringify({
					success: true,
					review_id: result.lastInsertRowid,
					message:
						"Review triggered successfully. The LLM Performance Reviewer will analyze data and generate recommendations.",
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Failed to trigger performance review:", error);
			return errorResponse("Failed to trigger performance review", 500);
		}
	};
}

/**
 * Respond to a performance review (accept/reject)
 */
export function createReviewResponseHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL): Promise<Response> => {
		try {
			const pathParts = url.pathname.split("/");
			const reviewId = pathParts[pathParts.indexOf("reviews") + 1];

			if (!reviewId || reviewId === "trigger") {
				return errorResponse("Review ID is required", 400);
			}

			const responseData = (await req.json()) as ReviewResponseRequest;

			if (
				!["accepted", "rejected", "pending"].includes(
					responseData.user_response,
				)
			) {
				return errorResponse(
					"user_response must be 'accepted', 'rejected', or 'pending'",
					400,
				);
			}

			const db = dbOps.getDatabase();

			// Update the review with user response
			const stmt = db.prepare(`
				UPDATE performance_reviews 
				SET user_response = ?
				WHERE id = ?
			`);

			const result = stmt.run(responseData.user_response, parseInt(reviewId));

			if (result.changes === 0) {
				return errorResponse("Performance review not found", 404);
			}

			// If accepted, this would trigger the Version Management Agent to deploy the new version
			if (responseData.user_response === "accepted") {
				log.info(
					`Performance review ${reviewId} accepted - triggering version deployment`,
				);
				// TODO: Integrate with Version Management Agent
			}

			return new Response(
				JSON.stringify({
					success: true,
					message: `Review ${responseData.user_response} successfully`,
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Failed to respond to performance review:", error);
			return errorResponse("Failed to respond to performance review", 500);
		}
	};
}
