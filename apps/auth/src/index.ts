import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { logger } from 'hono/logger'

import { authApp } from './routes/auth.js'
import { readFileSync } from 'node:fs';

const app = new Hono()

// auth の routes を追加
app.route('/_auth/api', authApp)

const __dirname = dirname(fileURLToPath(import.meta.url))
const webDistRoot = resolve(__dirname, '../../web/dist')
const isProd = process.env.NODE_ENV === 'production'

// API より先に静的ファイル（Vite base=/_auth と実パス dist/assets の差を吸収）
if (isProd) {
  app.use(
    '/_auth/*',
    serveStatic({
      root: webDistRoot,
      rewriteRequestPath: (pathname) => {
        const rest = pathname.replace(/^\/_auth(?=\/|$)/, '') || '/'
        return rest.startsWith('/') ? rest.slice(1) : rest
      },
    }),
  )
  app.get('/_auth/*', (c) => {
    return c.html(readFileSync(resolve(webDistRoot, 'index.html'), 'utf-8'))
  })
} else {
  app.use('*', logger())
}

serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
