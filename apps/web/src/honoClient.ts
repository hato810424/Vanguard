import { hc } from 'hono/client'
import type { AuthApp } from '../../auth/src/routes/auth'

export const honoClient = hc<AuthApp>('/_auth/api')
