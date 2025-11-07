// Copyright 2025 ccflare team
// SPDX-License-Identifier: MIT

/**
 * ccflare Desktop - Frontend Integration
 *
 * This module provides desktop-specific enhancements to the web dashboard,
 * including native system integration and server management.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Types for server management
interface ServerStatus {
	running: boolean;
	port: number;
	pid?: number;
}

class DesktopApp {
	private serverStatus: ServerStatus = { running: false, port: 8081 };
	private statusCheckInterval?: number;

	async init() {
		console.log("🚀 ccflare Desktop initializing...");

		// Set up window event listeners
		await this.setupWindowEvents();

		// Check initial server status
		await this.checkServerStatus();

		// Start status monitoring
		this.startStatusMonitoring();

		// Add desktop-specific UI enhancements
		this.enhanceUI();

		console.log("✅ ccflare Desktop ready!");
	}

	private async setupWindowEvents() {
		const _window = getCurrentWindow();

		// Listen for window close event to cleanup server
		await listen("tauri://close-requested", async () => {
			console.log("🔄 Shutting down server...");
			try {
				await this.stopServer();
			} catch (error) {
				console.error("Error stopping server:", error);
			}
		});
	}

	private async checkServerStatus(): Promise<ServerStatus> {
		try {
			this.serverStatus = await invoke<ServerStatus>("get_server_status");
			this.updateServerStatusUI();
			return this.serverStatus;
		} catch (error) {
			console.error("Error checking server status:", error);
			return { running: false, port: 8081 };
		}
	}

	private startStatusMonitoring() {
		// Check server status every 5 seconds
		this.statusCheckInterval = window.setInterval(async () => {
			await this.checkServerStatus();
		}, 5000);
	}

	private updateServerStatusUI() {
		// Add server status indicator to the UI
		const statusIndicator = document.querySelector("#server-status-indicator");
		if (statusIndicator) {
			const isRunning = this.serverStatus.running;
			statusIndicator.textContent = isRunning
				? "Server Running"
				: "Server Stopped";
			statusIndicator.className = `server-status ${isRunning ? "running" : "stopped"}`;
		}
	}

	private enhanceUI() {
		// Add desktop-specific styles
		const style = document.createElement("style");
		style.textContent = `
      .server-status {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .server-status.running {
        background-color: #dcfce7;
        color: #166534;
      }
      .server-status.stopped {
        background-color: #fef2f2;
        color: #dc2626;
      }
      .desktop-controls {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 1000;
        display: flex;
        gap: 8px;
      }
      .desktop-btn {
        padding: 6px 12px;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      .desktop-btn:hover {
        background: #f9fafb;
      }
      .desktop-btn.primary {
        background: #3b82f6;
        color: white;
        border-color: #3b82f6;
      }
      .desktop-btn.primary:hover {
        background: #2563eb;
      }
    `;
		document.head.appendChild(style);

		// Add desktop controls
		this.addDesktopControls();

		// Add server status indicator to navigation if it exists
		this.addServerStatusToNavigation();
	}

	private addDesktopControls() {
		const controls = document.createElement("div");
		controls.className = "desktop-controls";
		controls.innerHTML = `
      <button id="start-server-btn" class="desktop-btn primary">Start Server</button>
      <button id="stop-server-btn" class="desktop-btn">Stop Server</button>
      <div id="server-status-indicator" class="server-status stopped">Server Stopped</div>
    `;

		document.body.appendChild(controls);

		// Add event listeners
		document
			.getElementById("start-server-btn")
			?.addEventListener("click", () => this.startServer());
		document
			.getElementById("stop-server-btn")
			?.addEventListener("click", () => this.stopServer());
	}

	private addServerStatusToNavigation() {
		// Try to add status to existing navigation
		const nav = document.querySelector(".p-4.space-y-4"); // Footer section of navigation
		if (nav) {
			const statusWidget = document.createElement("div");
			statusWidget.className = "rounded-lg bg-muted/50 p-3";
			statusWidget.innerHTML = `
        <div class="flex items-center gap-2 text-sm">
          <svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-medium">Server Status</span>
        </div>
        <p id="nav-server-status" class="mt-1 text-xs text-muted-foreground">
          Checking server...
        </p>
      `;
			nav.appendChild(statusWidget);
		}
	}

	async startServer(): Promise<ServerStatus> {
		try {
			console.log("🚀 Starting ccflare server...");
			const status = await invoke<ServerStatus>("start_server");
			this.serverStatus = status;
			this.updateServerStatusUI();

			// Wait a moment for server to fully start, then redirect
			setTimeout(() => {
				if (status.running) {
					window.location.href = `http://localhost:${status.port}`;
				}
			}, 2000);

			return status;
		} catch (error) {
			console.error("Error starting server:", error);
			throw error;
		}
	}

	async stopServer(): Promise<ServerStatus> {
		try {
			console.log("🛑 Stopping ccflare server...");
			const status = await invoke<ServerStatus>("stop_server");
			this.serverStatus = status;
			this.updateServerStatusUI();
			return status;
		} catch (error) {
			console.error("Error stopping server:", error);
			throw error;
		}
	}

	async checkServerHealth(): Promise<boolean> {
		try {
			return await invoke<boolean>("check_server_health");
		} catch (error) {
			console.error("Error checking server health:", error);
			return false;
		}
	}

	cleanup() {
		if (this.statusCheckInterval) {
			clearInterval(this.statusCheckInterval);
		}
	}
}

// Initialize desktop app when DOM is ready
let desktopApp: DesktopApp;

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initApp);
} else {
	initApp();
}

async function initApp() {
	try {
		desktopApp = new DesktopApp();
		await desktopApp.init();

		// Make available globally for debugging
		(window as any).desktopApp = desktopApp;
	} catch (error) {
		console.error("Failed to initialize desktop app:", error);
	}
}

// Cleanup on unload
window.addEventListener("beforeunload", () => {
	desktopApp?.cleanup();
});
