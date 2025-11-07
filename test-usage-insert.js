const { Database } = require("bun:sqlite");
const path = require("path");

const dbPath = path.join(process.env.LOCALAPPDATA, "ccflare", "ccflare.db");
console.log("Database path:", dbPath);

const db = new Database(dbPath);

// Get accounts
const accounts = db.query("SELECT id, name FROM accounts").all();
console.log("Found accounts:", accounts);

if (accounts.length > 0) {
	const account = accounts[0];

	// Manually insert test usage data
	const testData = {
		unified_5h_status: "allowed",
		unified_5h_reset: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
		unified_7d_status: "allowed",
		unified_7d_reset: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
		unified_fallback_percentage: 0.65, // 65% used
		unified_representative_claim: "five_hour",
		unified_overage_disabled_reason: "overage_not_provisioned"
	};

	db.run(`
		UPDATE accounts SET
			unified_5h_status = ?,
			unified_5h_reset = ?,
			unified_7d_status = ?,
			unified_7d_reset = ?,
			unified_fallback_percentage = ?,
			unified_representative_claim = ?,
			unified_overage_disabled_reason = ?
		WHERE id = ?
	`, [
		testData.unified_5h_status,
		testData.unified_5h_reset,
		testData.unified_7d_status,
		testData.unified_7d_reset,
		testData.unified_fallback_percentage,
		testData.unified_representative_claim,
		testData.unified_overage_disabled_reason,
		account.id
	]);

	console.log(`✅ Inserted test data for account: ${account.name}`);
	console.log("Test data:", testData);

	// Verify
	const updated = db.query("SELECT unified_fallback_percentage, unified_representative_claim FROM accounts WHERE id = ?").get(account.id);
	console.log("Verified data:", updated);
}

db.close();
console.log("Done!");
