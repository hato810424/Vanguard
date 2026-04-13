function readEnv(key: keyof ImportMetaEnv): string | undefined {
  const raw = import.meta.env[key]
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  return t.length > 0 ? t : undefined
}

const DEFAULT_NAME = 'Vanguard'

const name = readEnv('VITE_BRAND_NAME') ?? DEFAULT_NAME

/** White-label / deploy-specific strings (override via `.env`) */
export const brand = {
  /** Shown in `document.title` and elsewhere */
  name,
  /** Small label above the login heading; defaults to `name` */
  loginKicker: readEnv('VITE_BRAND_LOGIN_KICKER') ?? name,
} as const
