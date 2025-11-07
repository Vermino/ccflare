import type { Database } from "bun:sqlite";
import { Logger } from "@ccflare/logger";
import { addPerformanceIndexes } from "./performance-indexes";

const log = new Logger("DatabaseMigrations");

export function ensureSchema(db: Database): void {
	// Create accounts table
	db.run(`
		CREATE TABLE IF NOT EXISTS accounts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			provider TEXT DEFAULT 'anthropic',
			api_key TEXT,
			refresh_token TEXT NOT NULL,
			access_token TEXT,
			expires_at INTEGER,
			created_at INTEGER NOT NULL,
			last_used INTEGER,
			request_count INTEGER DEFAULT 0,
			total_requests INTEGER DEFAULT 0,
			account_tier INTEGER DEFAULT 1
		)
	`);

	// Create requests table
	db.run(`
		CREATE TABLE IF NOT EXISTS requests (
			id TEXT PRIMARY KEY,
			timestamp INTEGER NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			account_used TEXT,
			status_code INTEGER,
			success BOOLEAN,
			error_message TEXT,
			response_time_ms INTEGER,
			failover_attempts INTEGER DEFAULT 0,
			model TEXT,
			prompt_tokens INTEGER DEFAULT 0,
			completion_tokens INTEGER DEFAULT 0,
			total_tokens INTEGER DEFAULT 0,
			cost_usd REAL DEFAULT 0,
			output_tokens_per_second REAL,
			input_tokens INTEGER DEFAULT 0,
			cache_read_input_tokens INTEGER DEFAULT 0,
			cache_creation_input_tokens INTEGER DEFAULT 0,
			output_tokens INTEGER DEFAULT 0,
			agent_used TEXT
		)
	`);

	// Create index for faster queries
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp DESC)`,
	);

	// Create request_payloads table for storing full request/response data
	db.run(`
		CREATE TABLE IF NOT EXISTS request_payloads (
			id TEXT PRIMARY KEY,
			json TEXT NOT NULL,
			FOREIGN KEY (id) REFERENCES requests(id) ON DELETE CASCADE
		)
	`);

	// Create oauth_sessions table for secure PKCE verifier storage
	db.run(`
		CREATE TABLE IF NOT EXISTS oauth_sessions (
			id TEXT PRIMARY KEY,
			account_name TEXT NOT NULL,
			verifier TEXT NOT NULL,
			mode TEXT NOT NULL,
			tier INTEGER DEFAULT 1,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL
		)
	`);

	// Create index for faster cleanup of expired sessions
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at)`,
	);

	// Create agent_preferences table for storing user-defined agent settings
	db.run(`
		CREATE TABLE IF NOT EXISTS agent_preferences (
			agent_id TEXT PRIMARY KEY,
			model TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);

	// Create api_keys table for multi-user access control
	db.run(`
		CREATE TABLE IF NOT EXISTS api_keys (
			id TEXT PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			hashed_key TEXT UNIQUE NOT NULL,
			prefix_last_8 TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			last_used INTEGER,
			usage_count INTEGER DEFAULT 0,
			is_active INTEGER DEFAULT 1,
			total_requests INTEGER DEFAULT 0,
			total_tokens INTEGER DEFAULT 0,
			total_cost_usd REAL DEFAULT 0,
			rate_limit_rpm INTEGER,
			rate_limit_tpm INTEGER,
			rate_limit_requests_per_day INTEGER
		)
	`);

	// Create indexes for faster API key lookups
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_api_keys_hashed ON api_keys(hashed_key)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)`,
	);
}

export function runMigrations(db: Database): void {
	// Ensure base schema exists first
	ensureSchema(db);
	// Check if columns exist before adding them
	const accountsInfo = db
		.prepare("PRAGMA table_info(accounts)")
		.all() as Array<{
		cid: number;
		name: string;
		type: string;
		notnull: number;
		// biome-ignore lint/suspicious/noExplicitAny: SQLite pragma can return various default value types
		dflt_value: any;
		pk: number;
	}>;

	const accountsColumnNames = accountsInfo.map((col) => col.name);

	// Add rate_limited_until column if it doesn't exist
	if (!accountsColumnNames.includes("rate_limited_until")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN rate_limited_until INTEGER",
		).run();
		log.info("Added rate_limited_until column to accounts table");
	}

	// Add session_start column if it doesn't exist
	if (!accountsColumnNames.includes("session_start")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN session_start INTEGER").run();
		log.info("Added session_start column to accounts table");
	}

	// Add session_request_count column if it doesn't exist
	if (!accountsColumnNames.includes("session_request_count")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN session_request_count INTEGER DEFAULT 0",
		).run();
		log.info("Added session_request_count column to accounts table");
	}

	// Add account_tier column if it doesn't exist
	if (!accountsColumnNames.includes("account_tier")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN account_tier INTEGER DEFAULT 1",
		).run();
		log.info("Added account_tier column to accounts table");
	}

	// Add paused column if it doesn't exist
	if (!accountsColumnNames.includes("paused")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN paused INTEGER DEFAULT 0",
		).run();
		log.info("Added paused column to accounts table");
	}

	// Add rate_limit_reset column if it doesn't exist
	if (!accountsColumnNames.includes("rate_limit_reset")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN rate_limit_reset INTEGER",
		).run();
		log.info("Added rate_limit_reset column to accounts table");
	}

	// Add rate_limit_status column if it doesn't exist
	if (!accountsColumnNames.includes("rate_limit_status")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN rate_limit_status TEXT").run();
		log.info("Added rate_limit_status column to accounts table");
	}

	// Add rate_limit_remaining column if it doesn't exist
	if (!accountsColumnNames.includes("rate_limit_remaining")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN rate_limit_remaining INTEGER",
		).run();
		log.info("Added rate_limit_remaining column to accounts table");
	}

	// Add detailed Anthropic rate limit columns
	if (!accountsColumnNames.includes("requests_limit")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN requests_limit INTEGER").run();
		log.info("Added requests_limit column to accounts table");
	}

	if (!accountsColumnNames.includes("requests_remaining")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN requests_remaining INTEGER",
		).run();
		log.info("Added requests_remaining column to accounts table");
	}

	if (!accountsColumnNames.includes("requests_reset")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN requests_reset INTEGER").run();
		log.info("Added requests_reset column to accounts table");
	}

	if (!accountsColumnNames.includes("tokens_limit")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN tokens_limit INTEGER").run();
		log.info("Added tokens_limit column to accounts table");
	}

	if (!accountsColumnNames.includes("tokens_remaining")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN tokens_remaining INTEGER",
		).run();
		log.info("Added tokens_remaining column to accounts table");
	}

	if (!accountsColumnNames.includes("tokens_reset")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN tokens_reset INTEGER").run();
		log.info("Added tokens_reset column to accounts table");
	}

	if (!accountsColumnNames.includes("input_tokens_limit")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN input_tokens_limit INTEGER",
		).run();
		log.info("Added input_tokens_limit column to accounts table");
	}

	if (!accountsColumnNames.includes("input_tokens_remaining")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN input_tokens_remaining INTEGER",
		).run();
		log.info("Added input_tokens_remaining column to accounts table");
	}

	if (!accountsColumnNames.includes("input_tokens_reset")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN input_tokens_reset INTEGER",
		).run();
		log.info("Added input_tokens_reset column to accounts table");
	}

	if (!accountsColumnNames.includes("output_tokens_limit")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN output_tokens_limit INTEGER",
		).run();
		log.info("Added output_tokens_limit column to accounts table");
	}

	if (!accountsColumnNames.includes("output_tokens_remaining")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN output_tokens_remaining INTEGER",
		).run();
		log.info("Added output_tokens_remaining column to accounts table");
	}

	if (!accountsColumnNames.includes("output_tokens_reset")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN output_tokens_reset INTEGER",
		).run();
		log.info("Added output_tokens_reset column to accounts table");
	}

	// Add new unified rate limit columns
	if (!accountsColumnNames.includes("unified_5h_status")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN unified_5h_status TEXT").run();
		log.info("Added unified_5h_status column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_5h_reset")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN unified_5h_reset INTEGER",
		).run();
		log.info("Added unified_5h_reset column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_7d_status")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN unified_7d_status TEXT").run();
		log.info("Added unified_7d_status column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_7d_reset")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN unified_7d_reset INTEGER",
		).run();
		log.info("Added unified_7d_reset column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_fallback_percentage")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN unified_fallback_percentage REAL",
		).run();
		log.info("Added unified_fallback_percentage column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_representative_claim")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN unified_representative_claim TEXT",
		).run();
		log.info("Added unified_representative_claim column to accounts table");
	}

	if (!accountsColumnNames.includes("unified_overage_disabled_reason")) {
		db.prepare(
			"ALTER TABLE accounts ADD COLUMN unified_overage_disabled_reason TEXT",
		).run();
		log.info("Added unified_overage_disabled_reason column to accounts table");
	}

	// Add organization_id column for fetching real usage from Claude API
	if (!accountsColumnNames.includes("organization_id")) {
		db.prepare("ALTER TABLE accounts ADD COLUMN organization_id TEXT").run();
		log.info("Added organization_id column to accounts table");
	}

	// Check columns in requests table
	const requestsInfo = db
		.prepare("PRAGMA table_info(requests)")
		.all() as Array<{
		cid: number;
		name: string;
		type: string;
		notnull: number;
		// biome-ignore lint/suspicious/noExplicitAny: SQLite pragma can return various default value types
		dflt_value: any;
		pk: number;
	}>;

	const requestsColumnNames = requestsInfo.map((col) => col.name);

	// Add model column if it doesn't exist
	if (!requestsColumnNames.includes("model")) {
		db.prepare("ALTER TABLE requests ADD COLUMN model TEXT").run();
		log.info("Added model column to requests table");
	}

	// Add prompt_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("prompt_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN prompt_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added prompt_tokens column to requests table");
	}

	// Add completion_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("completion_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN completion_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added completion_tokens column to requests table");
	}

	// Add total_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("total_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN total_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added total_tokens column to requests table");
	}

	// Add cost_usd column if it doesn't exist
	if (!requestsColumnNames.includes("cost_usd")) {
		db.prepare("ALTER TABLE requests ADD COLUMN cost_usd REAL DEFAULT 0").run();
		log.info("Added cost_usd column to requests table");
	}

	// Add input_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("input_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN input_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added input_tokens column to requests table");
	}

	// Add cache_read_input_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("cache_read_input_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN cache_read_input_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added cache_read_input_tokens column to requests table");
	}

	// Add cache_creation_input_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("cache_creation_input_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added cache_creation_input_tokens column to requests table");
	}

	// Add output_tokens column if it doesn't exist
	if (!requestsColumnNames.includes("output_tokens")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN output_tokens INTEGER DEFAULT 0",
		).run();
		log.info("Added output_tokens column to requests table");
	}

	// Add agent_used column if it doesn't exist
	if (!requestsColumnNames.includes("agent_used")) {
		db.prepare("ALTER TABLE requests ADD COLUMN agent_used TEXT").run();
		log.info("Added agent_used column to requests table");
	}

	// Add output_tokens_per_second column if it doesn't exist
	if (!requestsColumnNames.includes("output_tokens_per_second")) {
		db.prepare(
			"ALTER TABLE requests ADD COLUMN output_tokens_per_second REAL",
		).run();
		log.info("Added output_tokens_per_second column to requests table");
	}

	// Add performance indexes
	addPerformanceIndexes(db);

	// Add feedback system tables
	ensureFeedbackSchema(db);
}

export function ensureFeedbackSchema(db: Database): void {
	// Create projects table for tracking Claude Code projects
	db.run(`
		CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			path TEXT UNIQUE NOT NULL,
			claude_file_path TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			last_activity DATETIME,
			total_sessions INTEGER DEFAULT 0,
			avg_satisfaction REAL DEFAULT 0.0
		)
	`);

	// Create agent_versions table for version management
	db.run(`
		CREATE TABLE IF NOT EXISTS agent_versions (
			id INTEGER PRIMARY KEY,
			agent_type TEXT NOT NULL,
			version TEXT NOT NULL,
			model_config TEXT, -- JSON stored as TEXT
			performance_metrics TEXT, -- JSON stored as TEXT
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			created_by TEXT,
			is_active BOOLEAN DEFAULT FALSE,
			parent_version TEXT,
			UNIQUE(agent_type, version)
		)
	`);

	// Create agent_sessions table for session tracking
	db.run(`
		CREATE TABLE IF NOT EXISTS agent_sessions (
			id INTEGER PRIMARY KEY,
			project_id INTEGER REFERENCES projects(id),
			user_id TEXT,
			agent_type TEXT NOT NULL,
			agent_version TEXT NOT NULL,
			session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
			session_end DATETIME,
			request_count INTEGER DEFAULT 0,
			tools_used TEXT, -- JSON array stored as TEXT
			task_description TEXT,
			success_rating INTEGER, -- 1-5 scale
			completion_time_ms INTEGER,
			error_count INTEGER DEFAULT 0,
			FOREIGN KEY (agent_type, agent_version) REFERENCES agent_versions(agent_type, version)
		)
	`);

	// Create session_feedback table for detailed feedback collection
	db.run(`
		CREATE TABLE IF NOT EXISTS session_feedback (
			id INTEGER PRIMARY KEY,
			session_id INTEGER REFERENCES agent_sessions(id),
			feedback_type TEXT NOT NULL, -- 'success', 'error', 'user_rating', 'improvement_suggestion'
			feedback_data TEXT NOT NULL, -- JSON stored as TEXT
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			source TEXT DEFAULT 'user' -- 'user', 'system', 'llm_reviewer'
		)
	`);

	// Create performance_reviews table for LLM review system
	db.run(`
		CREATE TABLE IF NOT EXISTS performance_reviews (
			id INTEGER PRIMARY KEY,
			agent_type TEXT NOT NULL,
			current_version TEXT NOT NULL,
			review_period_start DATETIME,
			review_period_end DATETIME,
			sessions_analyzed INTEGER,
			review_summary TEXT, -- JSON stored as TEXT
			suggested_improvements TEXT, -- JSON stored as TEXT
			new_version_proposed TEXT,
			user_response TEXT, -- 'accepted', 'rejected', 'pending'
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`);

	// Create user_agent_preferences table for user preferences
	db.run(`
		CREATE TABLE IF NOT EXISTS user_agent_preferences (
			id INTEGER PRIMARY KEY,
			user_id TEXT NOT NULL,
			project_id INTEGER REFERENCES projects(id),
			agent_type TEXT NOT NULL,
			preferred_version TEXT,
			review_cadence TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly', 'manual'
			auto_update BOOLEAN DEFAULT FALSE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, project_id, agent_type)
		)
	`);

	// Create indexes for better performance
	db.run(`CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path)`);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_projects_last_activity ON projects(last_activity DESC)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_agent_versions_type_active ON agent_versions(agent_type, is_active)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_agent_sessions_project ON agent_sessions(project_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_agent ON agent_sessions(user_id, agent_type)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_agent_sessions_start ON agent_sessions(session_start DESC)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_session_feedback_session ON session_feedback(session_id)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_session_feedback_type ON session_feedback(feedback_type)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_performance_reviews_agent ON performance_reviews(agent_type, current_version)`,
	);
	db.run(
		`CREATE INDEX IF NOT EXISTS idx_user_preferences_user_project ON user_agent_preferences(user_id, project_id)`,
	);

	log.info("Feedback system database schema initialized");
}
