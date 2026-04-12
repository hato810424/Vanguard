import "dotenv/config";

import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema.js";
import { toLibsqlUrl } from "./toLibsqlUrl.js";

export const db = drizzle({
  connection: { url: toLibsqlUrl(process.env.DB_FILE_NAME) },
  schema,
});
