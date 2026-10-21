import { readFileSync } from "node:fs";
import postgres from "postgres";
async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const sql = postgres((urls.pooler as string).split("?")[0] + "?sslmode=require", { max: 1, prepare: false, ssl: "require" });
  try {
    const rows = await sql`select a.id, st.name, a.status, a.score, a.submitted_at, a.device_token
      from attempts a join students st on st.id=a.student_id
      where a.session_id='a84b658e-1d71-4fc6-8ea3-07b6a097e8ed' order by st.name`;
    console.log(JSON.stringify(rows, null, 2));
    const s = await sql`select status, ends_at, closed_at from sessions where id='a84b658e-1d71-4fc6-8ea3-07b6a097e8ed'`;
    console.log(s[0]);
  } finally { await sql.end({ timeout: 5 }); }
}
main();
