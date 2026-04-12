import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

import { toLibsqlUrl } from './src/db/toLibsqlUrl.js';

export default defineConfig({
  out: './database/migrations',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: toLibsqlUrl(process.env.DB_FILE_NAME),
  },
});
