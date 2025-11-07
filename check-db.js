import { Database } from "bun:sqlite";
import { resolveDbPath } from "./packages/database/src/paths.js";

const db = new Database(resolveDbPath());

console.log("\n📊 ACCOUNT USAGE DATA:");
console.log("=".repeat(80));

const accounts = db.prepare(`
  SELECT
    id,
    name,
    unified_fallback_percentage,
    unified_representative_claim,
    unified_5h_status,
    unified_7d_status,
    rate_limit_status,
    last_used,
    session_request_count,
    total_requests
  FROM accounts
  WHERE paused = 0
`).all();

for (const acc of accounts) {
  console.log(`\n${acc.name} (${acc.id}):`);
  console.log(`  Fallback %: ${acc.unified_fallback_percentage}`);
  console.log(`  Claim: ${acc.unified_representative_claim}`);
  console.log(`  5h Status: ${acc.unified_5h_status}`);
  console.log(`  7d Status: ${acc.unified_7d_status}`);
  console.log(`  Rate Limit Status: ${acc.rate_limit_status}`);
  console.log(`  Last Used: ${acc.last_used ? new Date(acc.last_used).toLocaleString() : 'Never'}`);
  console.log(`  Session Requests: ${acc.session_request_count}`);
  console.log(`  Total Requests: ${acc.total_requests}`);
}

console.log(`\n\n🕐 Current Time: ${new Date().toLocaleString()}`);
console.log(`\nℹ️  If "Last Used" is recent but Fallback % never changes, Claude API is returning stale data!`);

db.close();
