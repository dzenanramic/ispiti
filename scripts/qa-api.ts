import { readFileSync } from "node:fs";
import postgres from "postgres";
async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const sql = postgres((urls.pooler as string).split("?")[0] + "?sslmode=require", { max: 1, prepare: false, ssl: "require" });
  try {
    const sessionId = "a84b658e-1d71-4fc6-8ea3-07b6a097e8ed";
    const rows = await sql`select a.token, a.id attempt_id, s.name, q.id question_id, q.type, q.options
      from attempts a join students s on s.id=a.student_id join sessions se on se.id=a.session_id
      join questions q on q.quiz_id=se.quiz_id
      where a.session_id=${sessionId} and s.name='QA Amina Begić' order by q.position`;
    console.log(JSON.stringify(rows, null, 2));
  } finally { await sql.end({ timeout: 5 }); }
}
main();
