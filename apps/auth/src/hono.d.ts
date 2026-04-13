import 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    user: { cached: string; sid: string } | undefined
  }
}
