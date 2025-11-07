const { Database } = require("bun:sqlite");
const path = require("path");

const dbPath = path.join(process.env.LOCALAPPDATA, "ccflare", "ccflare.db");
console.log("Database path:", dbPath);

const db = new Database(dbPath);

const columns = [
  "ALTER TABLE accounts ADD COLUMN unified_5h_status TEXT",
  "ALTER TABLE accounts ADD COLUMN unified_5h_reset INTEGER",
  "ALTER TABLE accounts ADD COLUMN unified_7d_status TEXT",
  "ALTER TABLE accounts ADD COLUMN unified_7d_reset INTEGER",
  "ALTER TABLE accounts ADD COLUMN unified_fallback_percentage REAL",
  "ALTER TABLE accounts ADD COLUMN unified_representative_claim TEXT",
  "ALTER TABLE accounts ADD COLUMN unified_overage_disabled_reason TEXT",
];

for (const sql of columns) {
  try {
    db.run(sql);
    console.log("✅", sql);
  } catch (error) {
    console.log("⚠️ ", sql, "-", error.message);
  }
}

db.close();
console.log("\n🎉 Done! Columns added to database.");
