import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  loginId: text().primaryKey().notNull(),
  passwordHash: text().notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
});

export const sessions = sqliteTable("sessions", {
  id: text().primaryKey().notNull(),
  loginId: text().notNull().references(() => users.loginId),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
