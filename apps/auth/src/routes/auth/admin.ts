import { asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { db } from "../../db/dbConnect.js";
import { sessions, users } from "../../db/schema.js";
import { hashPassword } from "../../password.js";
import { getRedis, sessionCacheKey } from "../../redis/client.js";

export const adminApp = new Hono()
  .use(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const row = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.loginId, user.cached))
      .limit(1);
    if (!row[0]?.isAdmin) {
      return c.json({ error: "forbidden" }, 403);
    }

    return next();
  })
  .get("/users", async (c) => {
    const rows = await db
      .select({
        loginId: users.loginId,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .orderBy(asc(users.loginId));
    return c.json({ users: rows });
  })
  .post(
    "/users",
    zValidator(
      "json",
      z.object({
        loginId: z.string().min(1),
        password: z.string().min(1),
        isAdmin: z.boolean().optional().default(false),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      const existing = await db
        .select({ loginId: users.loginId })
        .from(users)
        .where(eq(users.loginId, body.loginId))
        .limit(1);
      if (existing[0]) {
        return c.json({ error: "loginId already exists" }, 409);
      }

      await db.insert(users).values({
        loginId: body.loginId,
        passwordHash: hashPassword(body.password),
        isAdmin: body.isAdmin,
      });
      return c.json({
        ok: true,
        loginId: body.loginId,
        isAdmin: body.isAdmin,
      });
    },
  )
  .delete("/users/:loginId", async (c) => {
    const loginId = c.req.param("loginId");
    const actor = c.get("user");
    if (!actor) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (loginId === actor.cached) {
      return c.json({ error: "cannot delete yourself" }, 400);
    }

    const target = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.loginId, loginId))
      .limit(1);
    if (!target[0]) {
      return c.json({ error: "user not found" }, 404);
    }

    if (target[0].isAdmin) {
      const adminCount = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.isAdmin, true));
      if (adminCount[0].count <= 1) {
        return c.json({ error: "cannot delete last admin" }, 400);
      }
    }

    const sessionRows = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.loginId, loginId));
    const redis = getRedis();
    if (redis) {
      for (const s of sessionRows) {
        try {
          await redis.del(sessionCacheKey(s.id));
        } catch (err) {
          console.error("redis del (admin delete user)", err);
        }
      }
    }

    await db.delete(users).where(eq(users.loginId, loginId));
    return c.json({ ok: true });
  });
