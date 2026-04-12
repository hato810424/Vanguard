import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { db } from "../db/dbConnect.js";
import { sessions, users } from "../db/schema.js";
import { getRedis, sessionCacheKey } from "../redis/client.js";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hashBuf = scryptSync(password, salt, 64);
  return `${salt}:${hashBuf.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const verifyBuf = scryptSync(password, salt, 64);
    if (hashBuf.length !== verifyBuf.length) return false;
    return timingSafeEqual(hashBuf, verifyBuf);
  } catch {
    return false;
  }
}

export const authApp = new Hono()
.get(
  "/",
  async (c) => {
    const userCount = await db.select({ count: count() }).from(users);
    if (userCount[0].count === 0) {
      return c.json({ create: true });
    }
    return c.json({ health: true });
  }
)
.post(
  "/create",
  zValidator('json', z.object({
    loginId: z.string().min(1),
    password: z.string().min(1),
  })),
  async (c) => {
    const userCount = await db.select({ count: count() }).from(users);
    if (userCount[0].count !== 0) {
      return c.json({ error: "user already exists" }, 400);
    }

    const body = c.req.valid("json");
    await db.insert(users).values({
      loginId: body.loginId,
      passwordHash: hashPassword(body.password),
    });
    return c.json({ ok: true, loginId: body.loginId });
  }
)
.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    loginId?: string;
    password?: string;
  } | null;
  if (!body?.loginId || !body?.password) {
    return c.json({ error: "loginId and password required" }, 400);
  }

  const row = await db
    .select()
    .from(users)
    .where(eq(users.loginId, body.loginId))
    .limit(1);
  const user = row[0];
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return c.json({ error: "invalid credentials" }, 401);
  }

  const id = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    id,
    loginId: user.loginId,
    createdAt: Date.now(),
  });

  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(
        sessionCacheKey(id),
        SESSION_MAX_AGE,
        user.loginId,
      );
    } catch (err) {
      console.error("redis setex (session)", err);
    }
  }

  setCookie(c, SESSION_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });

  return c.json({ ok: true, loginId: user.loginId });
})
.post("/logout", async (c) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await db.delete(sessions).where(eq(sessions.id, sid));
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(sessionCacheKey(sid));
      } catch (err) {
        console.error("redis del (session)", err);
      }
    }
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
})
.get("/verify", async (c) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) {
    return c.body(null, 401);
  }

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(sessionCacheKey(sid));
      if (cached) {
        return c.body(null, 204);
      }
    } catch (err) {
      console.error("redis get (session)", err);
    }
  }

  const row = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sid))
    .limit(1);
  const session = row[0];
  if (!session) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 401);
  }

  if (redis) {
    try {
      await redis.setex(
        sessionCacheKey(sid),
        SESSION_MAX_AGE,
        session.loginId,
      );
    } catch (err) {
      console.error("redis setex (session warm)", err);
    }
  }

  return c.body(null, 204);
});
