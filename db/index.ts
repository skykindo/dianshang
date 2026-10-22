import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { getPostgresPool } from "../lib/database";

export async function getDb() {
  return drizzle(await getPostgresPool(), { schema });
}
