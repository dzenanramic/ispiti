import { readFileSync } from "node:fs";
import postgres from "postgres";
async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const sql = postgres((urls.pooler as string).split("?")[0] + "?sslmode=require", { max: 1, prepare: false, ssl: "require" });
  try {
    const rows = await sql`select g.id, g.term, g.value, g.note, g.created_at, s.name
      from grades g join students s on s.id=g.student_id
      where s.name like 'QA%' order by g.created_at`;
    console.log(JSON.stringify(rows, null, 2));
  } finally { await sql.end({ timeout: 5 }); }
}
main();
