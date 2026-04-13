import { Hono } from "hono";
import { db } from "../../db/dbConnect.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export const adminApp = new Hono()
  .use(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const row = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.loginId, user.cached)).limit(1);
    if (!row[0].isAdmin) {
      return c.json({ error: "forbidden" }, 403);
    }

    return next();
  })
  
