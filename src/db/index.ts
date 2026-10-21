import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL nije postavljen. Kopiraj .env.example u .env.local.");
}

const isLocal =
  url.includes("localhost") || url.includes("127.0.0.1") || url.includes("::1");

// Supabase pooler (i većina serverless Postgres provajdera) ne podržava
// prepared statements preko transaction poolinga.
const client = postgres(url, {
  max: 5,
  prepare: false,
  ssl: isLocal ? false : "require",
});

export const db = drizzle(client, { schema });
export { client };
