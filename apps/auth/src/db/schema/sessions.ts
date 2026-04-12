import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users.js";

export const sessions = sqliteTable("sessions", {
  id: text().primaryKey().notNull(),
  loginId: text().notNull().references(() => users.loginId, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
