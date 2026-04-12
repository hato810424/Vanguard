import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  loginId: text().primaryKey().notNull(),
  passwordHash: text().notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
});
