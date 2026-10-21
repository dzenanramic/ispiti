import { readFileSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const url = (urls.pooler as string).split("?")[0] + "?sslmode=require";
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 20 });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    const cols = await sql`select column_name from information_schema.columns where table_name='teachers' order by ordinal_position`;
    console.log("teachers columns:", cols.map((c) => c.column_name).join(", "));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
