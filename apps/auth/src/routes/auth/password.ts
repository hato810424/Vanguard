import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { db } from "../../db/dbConnect.js";
import { users } from "../../db/schema.js";
import { hashPassword, verifyPassword } from "../../password.js";

export const passwordApp = new Hono().patch(
  "/",
  zValidator(
    "json",
    z.object({
      newPassword: z.string().min(1),
      confirmNewPassword: z.string().min(1),
      currentPassword: z.string().optional(),
    }),
  ),
  async (c) => {
    const sessionUser = c.get("user");
    if (!sessionUser) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    if (body.newPassword !== body.confirmNewPassword) {
      return c.json({ error: "new passwords do not match" }, 400);
    }

    const row = await db
      .select({
        loginId: users.loginId,
        passwordHash: users.passwordHash,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .where(eq(users.loginId, sessionUser.cached))
      .limit(1);
    const dbUser = row[0];
    if (!dbUser) {
      return c.json({ error: "user not found" }, 404);
    }

    if (!dbUser.isAdmin) {
      if (!body.currentPassword?.length) {
        return c.json({ error: "current password required" }, 400);
      }
      if (!verifyPassword(body.currentPassword, dbUser.passwordHash)) {
        return c.json({ error: "invalid current password" }, 401);
      }
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(body.newPassword) })
      .where(eq(users.loginId, dbUser.loginId));

    return c.json({ ok: true });
  },
);
