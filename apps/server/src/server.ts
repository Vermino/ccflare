import { dirname } from "node:path";
import { Config } from "@ccflare/config";
import type { LoadBalancingStrategy } from "@ccflare/core";
import {
	DEFAULT_STRATEGY,
	registerDisposable,
	setPricingLogger,
	shutdown,
} from "@ccflare/core";
import { container, SERVICE_KEYS } from "@ccflare/core-di";
// Import React dashboard assets
import dashboardManifest from "@ccflare/dashboard-web/dist/manifest.json";
import { AsyncDbWriter, DatabaseFactory } from "@ccflare/database";
import { APIRouter } from "@ccflare/http-api";
import { createStrategy } from "@ccflare/load-balancer";
import { Logger } from "@ccflare/logger";
import { getProvider, type Provider } from "@ccflare/providers";
import {
	getUsageWorker,
	handleProxy,
	type ProxyContext,
	terminateUsageWorker,
} from "@ccflare/proxy";
import { serve } from "bun";
import { printStartupBanner, printWorkerStatus } from "./startup-banner";
import packageJson from "../../../package.json";

// Initialize DI container
container.registerInstance(SERVICE_KEYS.Config, new Config());
container.registerInstance(SERVICE_KEYS.Logger, new Logger("Server"));

// Initialize components
const config = container.resolve<Config>(SERVICE_KEYS.Config);
const runtime = config.getRuntime();
DatabaseFactory.initialize(undefined, runtime);
const dbOps = DatabaseFactory.getInstance();
const db = dbOps.getDatabase();
container.registerInstance(SERVICE_KEYS.Database, dbOps);

// Initialize async DB writer
const asyncWriter = new AsyncDbWriter();
container.registerInstance(SERVICE_KEYS.AsyncWriter, asyncWriter);
registerDisposable(asyncWriter);

// Initialize pricing logger
const pricingLogger = new Logger("Pricing");
container.registerInstance(SERVICE_KEYS.PricingLogger, pricingLogger);
setPricingLogger(pricingLogger);

const apiRouter = new APIRouter({ db, config, dbOps });
const log = container.resolve<Logger>(SERVICE_KEYS.Logger);

// Load balancing strategy initialization
let strategy: LoadBalancingStrategy;

// Refresh token stampede prevention
const refreshInFlight = new Map<string, Promise<string>>();

// Get all providers from registry
const anthropicProvider = getProvider("anthropic");
const openaiProvider = getProvider("openai");

const providers = new Map<string, Provider>();
if (anthropicProvider) {
	providers.set(anthropicProvider.name, anthropicProvider);
	log.info(`Registered provider: ${anthropicProvider.name}`);
}
if (openaiProvider) {
	providers.set(openaiProvider.name, openaiProvider);
	log.info(`Registered provider: ${openaiProvider.name}`);
}

if (providers.size === 0) {
	throw new Error("No providers found in registry");
}

function initStrategy(): LoadBalancingStrategy {
	const strategyName = config.getStrategy();
	log.info(`Initializing load balancing strategy: ${strategyName}`);

	// Create strategy using factory
	const strategy = createStrategy(strategyName as any, {
		sessionDurationMs: runtime.sessionDurationMs,
	});
	strategy.initialize(dbOps);
	return strategy;
}

strategy = initStrategy();

// Create proxy context (without worker initially)
const proxyContext: ProxyContext = {
	strategy,
	dbOps,
	runtime,
	providers,
	refreshInFlight,
	asyncWriter,
	usageWorker: null as unknown as Worker, // Will be set below
};

// Initialize usage worker
printWorkerStatus("Usage Tracker", "starting");
proxyContext.usageWorker = getUsageWorker();
printWorkerStatus("Usage Tracker", "started");

// Watch for strategy changes
config.on("change", ({ key }) => {
	if (key === "lb_strategy") {
		log.info(`Strategy changed to ${config.getStrategy()}`);
		strategy = initStrategy();
		// Update proxy context strategy
		proxyContext.strategy = strategy;
	}
});

// Main server
const server = serve({
	port: runtime.port,
	idleTimeout: 255, // Max allowed by Bun
	async fetch(req) {
		const url = new URL(req.url);

		// Try API routes first
		const apiResponse = await apiRouter.handleRequest(url, req);
		if (apiResponse) {
			return apiResponse;
		}

		// Dashboard routes
		if (url.pathname === "/" || url.pathname === "/dashboard") {
			// Read the HTML file directly
			let dashboardPath: string;
			try {
				dashboardPath = Bun.resolveSync(
					"@ccflare/dashboard-web/dist/index.html",
					dirname(import.meta.path),
				);
			} catch {
				// Fallback to a relative path within the repo (development / mono-repo usage)
				dashboardPath = Bun.resolveSync(
					"../../../packages/dashboard-web/dist/index.html",
					dirname(import.meta.path),
				);
			}
			const file = Bun.file(dashboardPath);
			if (!file.exists()) {
				return new Response("Not Found", { status: 404 });
			}
			return new Response(file, {
				headers: { "Content-Type": "text/html" },
			});
		}

		// Serve dashboard static assets
		if ((dashboardManifest as Record<string, string>)[url.pathname]) {
			try {
				let assetPath: string;
				try {
					assetPath = Bun.resolveSync(
						`@ccflare/dashboard-web/dist${url.pathname}`,
						dirname(import.meta.path),
					);
				} catch {
					// Fallback to relative path in mono-repo
					assetPath = Bun.resolveSync(
						`../../../packages/dashboard-web/dist${url.pathname}`,
						dirname(import.meta.path),
					);
				}

				const file = Bun.file(assetPath);
				if (!file.exists()) {
					return new Response("Not Found", { status: 404 });
				}
				const mimeType = file.type || "application/octet-stream";
				return new Response(file, {
					headers: {
						"Content-Type": mimeType,
						"Cache-Control": "public, max-age=31536000",
					},
				});
			} catch {
				// Asset not found
			}
		}

		// Only proxy requests to Anthropic API
		if (!url.pathname.startsWith("/v1/")) {
			return new Response("Not Found", { status: 404 });
		}

		// Handle proxy request
		return handleProxy(req, url, proxyContext);
	},
});

// Log initial account status
const accounts = dbOps.getAllAccounts();
const activeAccounts = accounts.filter(
	(a) => !a.paused && (!a.expires_at || a.expires_at > Date.now()),
);

// Print startup banner
printStartupBanner({
	version: packageJson.version,
	port: server.port,
	strategy: config.getStrategy(),
	defaultStrategy: DEFAULT_STRATEGY,
	accountsTotal: accounts.length,
	accountsActive: activeAccounts.length,
	apiKeyAuthRequired: runtime.requireApiKey || false,
	providers: Array.from(providers.keys()),
});

if (activeAccounts.length === 0) {
	log.warn(
		"No active accounts available - requests will be forwarded without authentication",
	);
}

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("\n👋 Shutting down gracefully...");
	try {
		terminateUsageWorker();
		await shutdown();
		console.log("✅ Shutdown complete");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error during shutdown:", error);
		process.exit(1);
	}
});

process.on("SIGTERM", async () => {
	console.log("\n👋 Shutting down gracefully...");
	try {
		terminateUsageWorker();
		await shutdown();
		console.log("✅ Shutdown complete");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error during shutdown:", error);
		process.exit(1);
	}
});

// Export for programmatic use
export default function startServer(_options?: {
	port?: number;
	withDashboard?: boolean;
}) {
	// This is a placeholder for when the server needs to be started programmatically
	return {
		port: server.port,
		stop: () => {
			// Server stop logic
			server.stop();
		},
	};
}
