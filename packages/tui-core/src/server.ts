import { spawn } from "node:child_process";
import { join } from "node:path";

export interface ServeOptions {
	port?: number;
	withDashboard?: boolean;
}

export interface ServeResult {
	cleanup: () => void;
}

/**
 * Start the ccflare server
 */
export async function serve(options: ServeOptions = {}): Promise<ServeResult> {
	const port = options.port || 8081;

	return new Promise((resolve, reject) => {
		// Find the server executable path
		const serverPath = join(
			process.cwd(),
			"apps",
			"server",
			"src",
			"server.ts",
		);

		// Start server process
		const serverProcess = spawn("bun", ["run", serverPath], {
			stdio: "inherit",
			env: {
				...process.env,
				PORT: port.toString(),
			},
		});

		// Handle server startup
		serverProcess.on("error", (error) => {
			reject(new Error(`Failed to start server: ${error.message}`));
		});

		// Give server time to start up
		setTimeout(() => {
			resolve({
				cleanup: () => {
					serverProcess.kill();
				},
			});
		}, 1000);
	});
}
