import { readFileSync } from "node:fs";
import postgres from "postgres";
async function main() {
  const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
  const sql = postgres((urls.pooler as string).split("?")[0] + "?sslmode=require", { max: 1, prepare: false, ssl: "require" });
  try {
    const rows = await sql`select t.email, c.id class_id, c.name, q.id quiz_id, q.title, s.id session_id, s.code, s.status
      from teachers t join classes c on c.teacher_id=t.id left join sessions s on s.class_id=c.id left join quizzes q on q.id=s.quiz_id
      where t.email='qa.teacher@ispiti.local' order by s.created_at`;
    console.log(JSON.stringify(rows, null, 2));
  } finally { await sql.end({ timeout: 5 }); }
}
main();
