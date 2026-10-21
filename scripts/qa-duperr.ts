import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { db, client } = await import("../src/db");
  const { teachers } = await import("../src/db/schema");
  try {
    await db.insert(teachers).values({
      email: "profesor@ispiti.local",
      name: "Dup",
      passwordHash: "x",
      role: "teacher",
    });
  } catch (error) {
    const e = error as { code?: string; cause?: unknown; message?: string };
    console.log("name:", e.constructor?.name);
    console.log("message:", e.message);
    console.log("code:", e.code);
    console.log("cause:", e.cause);
  } finally {
    await client.end({ timeout: 5 });
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
