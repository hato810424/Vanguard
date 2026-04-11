import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema.js";

function toLibsqlUrl(raw: string | undefined): string {
  const v = raw?.trim();
  if (!v) {
    throw new Error(
      "DB_FILE_NAME is not set. Copy apps/auth/.env.example to apps/auth/.env",
    );
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) {
    return v;
  }
  return pathToFileURL(resolve(v)).href;
}

export const db = drizzle({
  connection: { url: toLibsqlUrl(process.env.DB_FILE_NAME) },
  schema,
});
