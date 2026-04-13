import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hashBuf = scryptSync(password, salt, 64);
  return `${salt}:${hashBuf.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
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
