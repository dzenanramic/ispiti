import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config();

async function main() {
  const [emailArg, password, nameArg] = process.argv.slice(2);
  const email = (emailArg ?? "").trim().toLowerCase();
  const name = (nameArg ?? "Administrator").trim();

  if (!email || !password) {
    console.error('Upotreba: npm run db:admin -- admin@skola.ba "lozinka" "Ime i prezime"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Lozinka mora imati najmanje 8 znakova.");
    process.exit(1);
  }

  const { db, client } = await import("./index");
  const schema = await import("./schema");
  const { hashPassword } = await import("../lib/auth");

  const passwordHash = await hashPassword(password);
  const [existing] = await db
    .select({ id: schema.teachers.id })
    .from(schema.teachers)
    .where(eq(schema.teachers.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(schema.teachers)
      .set({
        name,
        passwordHash,
        role: "admin",
        passwordChangedAt: new Date(),
      })
      .where(eq(schema.teachers.id, existing.id));
    console.log(`Admin nalog ažuriran: ${email}`);
  } else {
    await db.insert(schema.teachers).values({
      email,
      passwordHash,
      name,
      role: "admin",
    });
    console.log(`Admin nalog kreiran: ${email}`);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
