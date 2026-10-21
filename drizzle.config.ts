import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migracije idu direktnom vezom (Supabase port 5432), a aplikacija
    // koristi pooler (port 6543). Ako DIRECT_URL nije postavljen, koristi
    // se DATABASE_URL (lokalni razvoj).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
