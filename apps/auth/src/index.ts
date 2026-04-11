import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'

import { authApp } from './routes/auth.js'

const app = new Hono()

app.route('/_auth', authApp)

const __dirname = dirname(fileURLToPath(import.meta.url))
const webDistRoot = resolve(__dirname, '../../web/dist')
const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  app.use('/*', serveStatic({ root: webDistRoot }))
  app.get('/*', async (c) => {
    return c.html(await readFile(join(webDistRoot, 'index.html'), 'utf-8'))
  })
}

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
