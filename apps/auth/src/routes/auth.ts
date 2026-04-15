import { randomBytes } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { db } from "../db/dbConnect.js";
import { sessions, users } from "../db/schema.js";
import { getRedis, sessionCacheKey } from "../redis/client.js";
import { hashPassword, verifyPassword } from "../password.js";
import { HTTPException } from "hono/http-exception";
import { adminApp } from "./auth/admin.js";
import { passwordApp } from "./auth/password.js";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const authApp = new Hono()
// 認証情報埋め込み
.use(async (c, next) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) {
    return next();
  }

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(sessionCacheKey(sid));
      if (cached) {
        c.set("user", {
          cached,
          sid: sid,
        });
        return next();
      }
    } catch (err) {
      console.error("redis get (session)", err);
    }
  }

  const row = await db
    .select({ loginId: sessions.loginId })
    .from(sessions)
    .where(eq(sessions.id, sid))
    .limit(1);
  const session = row[0];
  if (session) {
    c.set("user", { cached: session.loginId, sid });
    if (redis) {
      try {
        await redis.setex(
          sessionCacheKey(sid),
          SESSION_MAX_AGE,
          session.loginId,
        );
      } catch (err) {
        console.error("redis setex (session hydrate)", err);
      }
    }
  }

  return next();
})
// ユーザー情報取得
.get(
  "/",
  async (c) => {
    const userCount = await db.select({ count: count() }).from(users);
    if (userCount[0].count === 0) {
      throw new HTTPException(404, { message: "not found" });
    }

    const user = c.get("user");

    if (!user) {
      throw new HTTPException(401, { message: "unauthorized" });
    }

    const row = await db
      .select({
        loginId: users.loginId,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.loginId, user.cached))
      .limit(1);
    return c.json(row[0]);
  }
)
// 管理者アカウント作成
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
      isAdmin: true,
    });
    return c.json({ ok: true, loginId: body.loginId });
  }
)
// ログイン
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
// ログアウト
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
// ログイン中ユーザーのパスワード変更
.route("/password", passwordApp)
// Nginx用 認証検証API
.get("/verify", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.body(null, 401);
  }

  const row = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, user.sid))
    .limit(1);
  const session = row[0];
  if (!session) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 401);
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(
        sessionCacheKey(user.sid),
        SESSION_MAX_AGE,
        session.loginId,
      );
    } catch (err) {
      console.error("redis setex (session warm)", err);
    }
  }

  return c.body(null, 204);
})
// 管理者
.route("/admin", adminApp);

export type AuthApp = typeof authApp;
