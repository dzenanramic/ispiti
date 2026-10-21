import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config();

async function main() {
  const [emailArg, password] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();

  if (!email || !password) {
    console.error('Upotreba: npm run db:password -- email@skola.ba "nova-lozinka"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Lozinka mora imati najmanje 8 znakova.");
    process.exit(1);
  }

  const { db, client } = await import("./index");
  const schema = await import("./schema");
  const { hashPassword } = await import("../lib/auth");

  const [teacher] = await db
    .select({ id: schema.teachers.id, name: schema.teachers.name })
    .from(schema.teachers)
    .where(eq(schema.teachers.email, email))
    .limit(1);

  if (!teacher) {
    console.error(`Nema naloga sa emailom ${email}.`);
    await client.end();
    process.exit(1);
  }

  await db
    .update(schema.teachers)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(schema.teachers.id, teacher.id));

  console.log(`Lozinka promijenjena za ${teacher.name} (${email}).`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
