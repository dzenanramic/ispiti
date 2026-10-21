import { readFileSync } from "node:fs";
import postgres from "postgres";

const urls = JSON.parse(readFileSync(".supabase-urls.json", "utf8"));
const url = (urls.pooler as string).split("?")[0] + "?sslmode=require";

async function main() {
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
  try {
    const teachers = await sql`select id, email, name, role, created_at from teachers order by created_at`;
    console.log("TEACHERS", teachers.length);
    for (const t of teachers) console.log(" ", t.email, "|", t.name, "|", t.role);
    const classes = await sql`select c.id, c.name, c.school_year, t.email from classes c join teachers t on t.id=c.teacher_id order by c.created_at`;
    console.log("CLASSES", classes.length);
    for (const c of classes) console.log(" ", c.name, "|", c.school_year, "|", c.email);
    const counts = await sql`select
      (select count(*) from students) students,
      (select count(*) from quizzes) quizzes,
      (select count(*) from questions) questions,
      (select count(*) from sessions) sessions,
      (select count(*) from attempts) attempts,
      (select count(*) from answers) answers,
      (select count(*) from grades) grades`;
    console.log("COUNTS", counts[0]);
    const sessions = await sql`select s.id, s.code, s.status, s.duration_seconds, s.started_at, s.ends_at, q.title, c.name class from sessions s join quizzes q on q.id=s.quiz_id join classes c on c.id=s.class_id order by s.created_at`;
    console.log("SESSIONS", sessions.length);
    for (const s of sessions) console.log(" ", s.code, s.status, s.title, "|", s.class, "|", s.ends_at);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
