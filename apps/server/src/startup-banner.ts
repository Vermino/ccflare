import { Logger } from "@ccflare/logger";

const log = new Logger("Startup");

interface StartupBannerOptions {
	version: string;
	port: number;
	host?: string;
	strategy: string;
	defaultStrategy: string;
	accountsTotal: number;
	accountsActive: number;
	apiKeyAuthRequired: boolean;
}

export function printStartupBanner(options: StartupBannerOptions): void {
	const {
		version,
		port,
		host = "0.0.0.0",
		strategy,
		defaultStrategy,
		accountsTotal,
		accountsActive,
		apiKeyAuthRequired,
	} = options;

	console.log("\n");
	console.log("🎯 ccflare Server v" + version);
	console.log("🌐 Port: " + port);
	console.log("🌍 Host: " + host);
	console.log("\n📊 Dashboard: http://localhost:" + port);
	console.log("🔗 API Base: http://localhost:" + port + "/api");
	console.log("\n Available endpoints:");
	console.log("- POST   http://localhost:" + port + "/v1/*                  → Proxy to Claude API");
	console.log("- GET    http://localhost:" + port + "/health                → Health check");
	console.log("- GET    http://localhost:" + port + "/api/accounts          → List accounts");
	console.log("- POST   http://localhost:" + port + "/api/accounts          → Add account");
	console.log("- DELETE http://localhost:" + port + "/api/accounts/:id      → Remove account");
	console.log("- GET    http://localhost:" + port + "/api/stats             → View statistics");
	console.log("- POST   http://localhost:" + port + "/api/stats/reset       → Reset statistics");
	console.log("- GET    http://localhost:" + port + "/api/config            → View configuration");
	console.log("- POST   http://localhost:" + port + "/api/config/strategy   → Update strategy");
	console.log("- GET    http://localhost:" + port + "/api/requests          → Request history");
	console.log("- GET    http://localhost:" + port + "/api/analytics         → Analytics data");
	console.log("- GET    http://localhost:" + port + "/api/api-keys          → List API keys");
	console.log("- POST   http://localhost:" + port + "/api/api-keys          → Create API key");
	console.log("- GET    http://localhost:" + port + "/api/claude/usage      → Claude usage data");
	console.log("- GET    http://localhost:" + port + "/api/agents            → Agent list");
	console.log("- GET    http://localhost:" + port + "/api/projects          → Project list");
	console.log("- GET    http://localhost:" + port + "/api/bandwidth         → Bandwidth stats");
	console.log("- POST   http://localhost:" + port + "/api/oauth/init        → OAuth init");
	console.log("- POST   http://localhost:" + port + "/api/oauth/callback    → OAuth callback");

	console.log("\n⚙️  Load Balancing: " + strategy + (strategy !== defaultStrategy ? ` (default: ${defaultStrategy})` : ""));
	console.log("👥 Accounts: " + accountsTotal + " total, " + accountsActive + " active");

	if (apiKeyAuthRequired) {
		console.log("🔐 API Key Auth: REQUIRED");
	} else {
		console.log("🔓 API Key Auth: Optional");
	}

	console.log("\n⚡ Ready to proxy requests...\n");
}

export function printDotenvLoading(files: string[], varsLoaded: number): void {
	for (const file of files) {
		log.info(`[dotenv] injecting env (${varsLoaded}) from ${file}`);
	}
}

export function printWorkerStatus(workerName: string, status: "starting" | "started" | "stopped"): void {
	const emoji = status === "started" ? "✅" : status === "starting" ? "⚙️" : "🛑";
	log.info(`[WORKER] ${workerName} ${status} ${emoji}`);
}
