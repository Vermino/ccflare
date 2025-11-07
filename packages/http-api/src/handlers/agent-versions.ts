import type { Database } from "bun:sqlite";
import type { DatabaseOperations } from "@ccflare/database";
import { Logger } from "@ccflare/logger";
import { errorResponse } from "../utils/http-error";

const log = new Logger("AgentVersionsHandler");

export interface AgentVersion {
	id: number;
	agent_type: string;
	version: string;
	model_config?: string;
	performance_metrics?: string;
	created_at: string;
	created_by?: string;
	is_active: boolean;
	parent_version?: string;
}

export interface AgentVersionCreate {
	agent_type: string;
	version: string;
	model_config?: Record<string, unknown>;
	performance_metrics?: Record<string, unknown>;
	created_by?: string;
	parent_version?: string;
}

export interface AgentVersionUpdate {
	is_active?: boolean;
	model_config?: Record<string, unknown>;
	performance_metrics?: Record<string, unknown>;
}

/**
 * List all agent versions
 */
export function createAgentVersionsListHandler(db: Database) {
	return (_req: Request, url: URL): Response => {
		try {
			const agentType = url.searchParams.get("agent_type");
			const activeOnly = url.searchParams.get("active_only") === "true";

			let whereClause = "WHERE 1=1";
			const params: string[] = [];

			if (agentType) {
				whereClause += " AND agent_type = ?";
				params.push(agentType);
			}

			if (activeOnly) {
				whereClause += " AND is_active = 1";
			}

			const stmt = db.prepare(`
				SELECT 
					id, agent_type, version, model_config, performance_metrics,
					created_at, created_by, is_active, parent_version
				FROM agent_versions 
				${whereClause}
				ORDER BY agent_type, created_at DESC
			`);

			const versions = stmt.all(...params) as AgentVersion[];

			// Parse JSON fields
			const parsedVersions = versions.map((version) => ({
				...version,
				model_config: version.model_config
					? JSON.parse(version.model_config)
					: null,
				performance_metrics: version.performance_metrics
					? JSON.parse(version.performance_metrics)
					: null,
				is_active: Boolean(version.is_active),
			}));

			return new Response(JSON.stringify(parsedVersions), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to list agent versions:", error);
			return errorResponse("Failed to list agent versions", 500);
		}
	};
}

/**
 * Create new agent version
 */
export function createAgentVersionCreateHandler(dbOps: DatabaseOperations) {
	return async (req: Request): Promise<Response> => {
		try {
			const versionData = (await req.json()) as AgentVersionCreate;

			if (!versionData.agent_type || !versionData.version) {
				return errorResponse("agent_type and version are required", 400);
			}

			const db = dbOps.getDatabase();

			// Check if version already exists
			const existingStmt = db.prepare(`
				SELECT COUNT(*) as count
				FROM agent_versions
				WHERE agent_type = ? AND version = ?
			`);
			const existing = existingStmt.get(
				versionData.agent_type,
				versionData.version,
			) as { count: number };

			if (existing.count > 0) {
				return errorResponse("Version already exists for this agent type", 409);
			}

			const stmt = db.prepare(`
				INSERT INTO agent_versions (
					agent_type, version, model_config, performance_metrics,
					created_by, parent_version, is_active
				) VALUES (?, ?, ?, ?, ?, ?, 0)
			`);

			const result = stmt.run(
				versionData.agent_type,
				versionData.version,
				versionData.model_config
					? JSON.stringify(versionData.model_config)
					: null,
				versionData.performance_metrics
					? JSON.stringify(versionData.performance_metrics)
					: null,
				versionData.created_by || "system",
				versionData.parent_version || null,
			);

			return new Response(
				JSON.stringify({
					success: true,
					id: result.lastInsertRowid,
				}),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		} catch (error) {
			log.error("Failed to create agent version:", error);
			return errorResponse("Failed to create agent version", 500);
		}
	};
}

/**
 * Update agent version
 */
export function createAgentVersionUpdateHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL): Promise<Response> => {
		try {
			const pathParts = url.pathname.split("/");
			const versionId = pathParts[pathParts.length - 1];

			if (!versionId || versionId === "versions") {
				return errorResponse("Version ID is required", 400);
			}

			const updateData = (await req.json()) as AgentVersionUpdate;
			const db = dbOps.getDatabase();

			// Build dynamic update query
			const updateFields: string[] = [];
			const params: unknown[] = [];

			if (updateData.is_active !== undefined) {
				updateFields.push("is_active = ?");
				params.push(updateData.is_active ? 1 : 0);
			}

			if (updateData.model_config !== undefined) {
				updateFields.push("model_config = ?");
				params.push(JSON.stringify(updateData.model_config));
			}

			if (updateData.performance_metrics !== undefined) {
				updateFields.push("performance_metrics = ?");
				params.push(JSON.stringify(updateData.performance_metrics));
			}

			if (updateFields.length === 0) {
				return errorResponse("No fields to update", 400);
			}

			params.push(parseInt(versionId));

			const stmt = db.prepare(`
				UPDATE agent_versions 
				SET ${updateFields.join(", ")}
				WHERE id = ?
			`);

			const result = stmt.run(...params);

			if (result.changes === 0) {
				return errorResponse("Agent version not found", 404);
			}

			return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to update agent version:", error);
			return errorResponse("Failed to update agent version", 500);
		}
	};
}

/**
 * Rollback agent version (delete/deactivate)
 */
export function createAgentVersionRollbackHandler(dbOps: DatabaseOperations) {
	return async (req: Request, url: URL): Promise<Response> => {
		try {
			const pathParts = url.pathname.split("/");
			const versionId = pathParts[pathParts.length - 1];

			if (!versionId || versionId === "versions") {
				return errorResponse("Version ID is required", 400);
			}

			const { action = "deactivate" } = (await req.json()) as {
				action?: "deactivate" | "delete";
			};
			const db = dbOps.getDatabase();

			if (action === "delete") {
				// Actually delete the version (use with caution)
				const stmt = db.prepare("DELETE FROM agent_versions WHERE id = ?");
				const result = stmt.run(parseInt(versionId));

				if (result.changes === 0) {
					return errorResponse("Agent version not found", 404);
				}
			} else {
				// Just deactivate the version
				const stmt = db.prepare(`
					UPDATE agent_versions 
					SET is_active = 0
					WHERE id = ?
				`);
				const result = stmt.run(parseInt(versionId));

				if (result.changes === 0) {
					return errorResponse("Agent version not found", 404);
				}
			}

			return new Response(JSON.stringify({ success: true, action }), {
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			log.error("Failed to rollback agent version:", error);
			return errorResponse("Failed to rollback agent version", 500);
		}
	};
}
