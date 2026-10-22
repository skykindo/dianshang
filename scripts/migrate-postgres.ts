import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("[db:migrate] DATABASE_URL 未配置。");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1 });

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle/postgres" });
  console.log("[db:migrate] PostgreSQL 迁移完成。");
} finally {
  await pool.end();
}
