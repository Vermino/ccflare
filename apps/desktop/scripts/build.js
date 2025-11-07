#!/usr/bin/env node

/**
 * Build script for ccflare Desktop
 *
 * This script coordinates the build process:
 * 1. Build the web dashboard
 * 2. Build the Tauri desktop app
 * 3. Package for distribution
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");
const DESKTOP_DIR = path.resolve(import.meta.dirname, "..");
const DASHBOARD_DIR = path.resolve(ROOT_DIR, "packages/dashboard-web");

console.log("🏗️  Building ccflare Desktop...\n");

// Step 1: Build web dashboard
console.log("📦 Building web dashboard...");
if (!existsSync(DASHBOARD_DIR)) {
	console.error("❌ Dashboard directory not found:", DASHBOARD_DIR);
	process.exit(1);
}

try {
	execSync("bun run build", {
		cwd: DASHBOARD_DIR,
		stdio: "inherit",
	});
	console.log("✅ Web dashboard build complete\n");
} catch (_error) {
	console.error("❌ Failed to build web dashboard");
	process.exit(1);
}

// Step 2: Build Tauri app
console.log("🦀 Building Tauri desktop app...");
try {
	execSync("tauri build", {
		cwd: DESKTOP_DIR,
		stdio: "inherit",
	});
	console.log("✅ Desktop app build complete\n");
} catch (_error) {
	console.error("❌ Failed to build desktop app");
	process.exit(1);
}

console.log("🎉 ccflare Desktop build successful!");
console.log("📍 Binaries available in: apps/desktop/src-tauri/target/release/");

// List generated files
try {
	const targetDir = path.join(DESKTOP_DIR, "src-tauri/target/release");
	if (existsSync(targetDir)) {
		console.log("\n📦 Generated files:");
		execSync(`ls -la "${targetDir}"`, { stdio: "inherit" });
	}
} catch (_error) {
	// Ignore listing errors
}
