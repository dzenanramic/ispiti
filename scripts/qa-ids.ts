import { readFileSync } from "node:fs";
import postgres from "postgres";
async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const sql = postgres((urls.pooler as string).split("?")[0] + "?sslmode=require", { max: 1, prepare: false, ssl: "require" });
  try {
    const rows = await sql`select q.id quiz_id, q.title, s.id session_id, s.code, c.id class_id, c.name from quizzes q join sessions s on s.quiz_id=q.id join classes c on c.id=s.class_id where c.name='Treci'`;
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main();
