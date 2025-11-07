import { parseArgs } from "node:util";
import { Config } from "@ccflare/config";
import { shutdown } from "@ccflare/core";
import { container, SERVICE_KEYS } from "@ccflare/core-di";
import { DatabaseFactory } from "@ccflare/database";
import {
	addAccount,
	getAccountsList,
	pauseAccount,
	removeAccountWithConfirmation,
	resumeAccount,
} from "./commands/account";
import { analyzePerformance } from "./commands/analyze";
import {
	createApiKey,
	deleteApiKey,
	disableApiKey,
	enableApiKey,
	listApiKeys,
	updateApiKeyLimits,
} from "./commands/api-key";
import { getHelpText } from "./commands/help";
import { clearRequestHistory, resetAllStats } from "./commands/stats";

/**
 * Main CLI runner
 */
export async function runCli(argv: string[]): Promise<void> {
	// Initialize DI container and services
	container.registerInstance(SERVICE_KEYS.Config, new Config());
	const config = container.resolve<Config>(SERVICE_KEYS.Config);
	DatabaseFactory.initialize();
	const dbOps = DatabaseFactory.getInstance();
	container.registerInstance(SERVICE_KEYS.Database, dbOps);

	try {
		// Parse command line arguments
		const { positionals, values } = parseArgs({
			args: argv.slice(2),
			strict: false,
			options: {
				mode: { type: "string" },
				tier: { type: "string" },
				force: { type: "boolean" },
				rpm: { type: "string" },
				tpm: { type: "string" },
				daily: { type: "string" },
			},
		});

		const command = positionals[0];

		switch (command) {
			case "add": {
				const name = positionals[1];
				if (!name) {
					console.error("Error: Account name is required");
					console.log(
						"Usage: ccflare-cli add <name> [--mode <max|console>] [--tier <1|5|20>]",
					);
					process.exit(1);
				}

				// Parse options
				const mode = values.mode as "max" | "console" | undefined;
				const tierValue = values.tier
					? parseInt(values.tier as string)
					: undefined;
				const tier =
					tierValue === 1 || tierValue === 5 || tierValue === 20
						? tierValue
						: undefined;

				await addAccount(dbOps, config, { name, mode, tier });
				break;
			}

			case "list": {
				const accounts = getAccountsList(dbOps);

				if (accounts.length === 0) {
					console.log("No accounts found");
				} else {
					console.log(`\nAccounts (${accounts.length}):`);
					console.log("─".repeat(100));

					// Header
					console.log(
						"Name".padEnd(20) +
							"Type".padEnd(10) +
							"Tier".padEnd(6) +
							"Requests".padEnd(12) +
							"Token".padEnd(10) +
							"Status".padEnd(20) +
							"Session",
					);
					console.log("─".repeat(100));

					// Rows
					for (const account of accounts) {
						console.log(
							account.name.padEnd(20) +
								account.provider.padEnd(10) +
								account.tierDisplay.padEnd(6) +
								`${account.requestCount}/${account.totalRequests}`.padEnd(12) +
								account.tokenStatus.padEnd(10) +
								account.rateLimitStatus.padEnd(20) +
								account.sessionInfo,
						);
					}
				}
				break;
			}

			case "remove": {
				const name = positionals[1];
				if (!name) {
					console.error("Error: Account name is required");
					console.log("Usage: ccflare-cli remove <name> [--force]");
					process.exit(1);
				}

				const result = await removeAccountWithConfirmation(
					dbOps,
					name,
					values.force === true,
				);
				console.log(result.message);
				if (!result.success) {
					process.exit(1);
				}
				break;
			}

			case "reset-stats": {
				const db = dbOps.getDatabase();
				resetAllStats(db);
				console.log("Account statistics reset successfully");
				break;
			}

			case "clear-history": {
				const db = dbOps.getDatabase();
				const result = clearRequestHistory(db);
				console.log(`Cleared ${result.count} request records`);
				break;
			}

			case "pause": {
				const name = positionals[1];
				if (!name) {
					console.error("Error: Account name is required");
					console.log("Usage: ccflare-cli pause <name>");
					process.exit(1);
				}

				const result = pauseAccount(dbOps, name);
				console.log(result.message);
				if (!result.success) {
					process.exit(1);
				}
				break;
			}

			case "resume": {
				const name = positionals[1];
				if (!name) {
					console.error("Error: Account name is required");
					console.log("Usage: ccflare-cli resume <name>");
					process.exit(1);
				}

				const result = resumeAccount(dbOps, name);
				console.log(result.message);
				if (!result.success) {
					process.exit(1);
				}
				break;
			}

			case "analyze": {
				const db = dbOps.getDatabase();
				analyzePerformance(db);
				break;
			}

			case "api-key:create": {
				const name = positionals[1];
				if (!name) {
					console.error("Error: API key name is required");
					console.log(
						"Usage: ccflare-cli api-key:create <name> [--rpm <limit>] [--tpm <limit>] [--daily <limit>]",
					);
					process.exit(1);
				}

				const rpm = values.rpm ? parseInt(values.rpm as string) : undefined;
				const tpm = values.tpm ? parseInt(values.tpm as string) : undefined;
				const daily = values.daily
					? parseInt(values.daily as string)
					: undefined;

				await createApiKey(dbOps, {
					name,
					rateLimitRpm: rpm,
					rateLimitTpm: tpm,
					rateLimitRequestsPerDay: daily,
				});
				break;
			}

			case "api-key:list": {
				const apiKeys = listApiKeys(dbOps);

				if (apiKeys.length === 0) {
					console.log("No API keys found");
				} else {
					console.log(`\nAPI Keys (${apiKeys.length}):`);
					console.log("─".repeat(120));

					// Header
					console.log(
						"Name".padEnd(20) +
							"Key Suffix".padEnd(12) +
							"Status".padEnd(10) +
							"Requests".padEnd(12) +
							"Tokens".padEnd(12) +
							"Cost".padEnd(10) +
							"Created".padEnd(12) +
							"Last Used",
					);
					console.log("─".repeat(120));

					// Rows
					for (const key of apiKeys) {
						const status = key.isActive ? "Active" : "Inactive";
						const created = key.createdAt.toLocaleDateString();
						const lastUsed = key.lastUsed
							? key.lastUsed.toLocaleDateString()
							: "Never";

						console.log(
							key.name.padEnd(20) +
								`...${key.prefixLast8}`.padEnd(12) +
								status.padEnd(10) +
								key.totalRequests.toString().padEnd(12) +
								key.totalTokens.toString().padEnd(12) +
								`$${key.totalCostUsd.toFixed(4)}`.padEnd(10) +
								created.padEnd(12) +
								lastUsed,
						);
					}
				}
				break;
			}

			case "api-key:delete": {
				const nameOrId = positionals[1];
				if (!nameOrId) {
					console.error("Error: API key name or ID is required");
					console.log("Usage: ccflare-cli api-key:delete <name|id> [--force]");
					process.exit(1);
				}

				await deleteApiKey(dbOps, nameOrId);
				break;
			}

			case "api-key:enable": {
				const nameOrId = positionals[1];
				if (!nameOrId) {
					console.error("Error: API key name or ID is required");
					console.log("Usage: ccflare-cli api-key:enable <name|id>");
					process.exit(1);
				}

				enableApiKey(dbOps, nameOrId);
				break;
			}

			case "api-key:disable": {
				const nameOrId = positionals[1];
				if (!nameOrId) {
					console.error("Error: API key name or ID is required");
					console.log("Usage: ccflare-cli api-key:disable <name|id>");
					process.exit(1);
				}

				disableApiKey(dbOps, nameOrId);
				break;
			}

			default: {
				console.log(getHelpText());
				if (command && command !== "help") {
					console.error(`\nError: Unknown command '${command}'`);
					process.exit(1);
				}
				break;
			}
		}
	} catch (error) {
		console.error(`Error: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	} finally {
		// Always shutdown resources
		await shutdown();
	}
}
