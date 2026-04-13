import { createFileRoute } from '@tanstack/react-router'
import { type SubmitEvent, useEffect, useState } from 'react'

import styles from './login.module.css'

function safeReturnPath(next: string | undefined): string {
  if (!next) return '/'
  if (!next.startsWith('/') || next.startsWith('//')) return '/'
  if (
    next === '/_auth' ||
    next.startsWith('/_auth?') ||
    next.startsWith('/_auth/')
  )
    return '/'
  return next
}

export const Route = createFileRoute('/')({
  validateSearch: (raw: Record<string, unknown>): { next?: string } => {
    const next = raw.next
    if (typeof next === 'string' && next.length > 0) return { next }
    return {}
  },
  component: LoginPage,
})

type PageMode = 'login' | 'create'

function LoginPage() {
  const { next } = Route.useSearch()
  const [mode, setMode] = useState<PageMode>('login')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/_auth/api', { credentials: 'include' })
        if (cancelled) return
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            create?: boolean
          }
          if (data.create) {
            setMode('create')
            return
          }
        }
        setMode('login')
      } catch {
        if (!cancelled) setMode('login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function postLogin(): Promise<boolean> {
    const res = await fetch('/_auth/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId, password }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(
        res.status === 401
          ? 'ログインIDまたはパスワードが正しくありません'
          : (data.error ?? 'ログインに失敗しました'),
      )
      return false
    }
    return true
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      if (mode === 'create') {
        const res = await fetch('/_auth/api/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ loginId, password }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) {
          setError(
            data.error === 'user already exists'
              ? 'すでにユーザーが登録されています。ログインしてください。'
              : (data.error ?? 'アカウントの作成に失敗しました'),
          )
          if (res.status === 400 && data.error === 'user already exists') {
            setMode('login')
          }
          return
        }
      }
      if (!(await postLogin())) return
      window.location.assign(safeReturnPath(next))
    } catch {
      setError('通信に失敗しました。サーバーが起動しているか確認してください。')
    } finally {
      setPending(false)
    }
  }

  const isCreate = mode === 'create'

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <p className={styles.kicker}>Account</p>
        <h1 className={styles.title}>
          {isCreate ? '管理者アカウントの作成' : 'ログイン'}
        </h1>
        {isCreate && (
          <p className={styles.desc}>
            まだユーザーがいません。最初の管理者のログインIDとパスワードを設定してください。
          </p>
        )}

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.field}>
            <label htmlFor="login-id" className={styles.label}>
              ログインID
            </label>
            <input
              id="login-id"
              name="loginId"
              type="text"
              autoComplete="username"
              required
              value={loginId}
              onChange={(ev) => setLoginId(ev.target.value)}
              className={styles.input}
              placeholder="example"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="login-password" className={styles.label}>
              パスワード
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete={isCreate ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className={styles.submit}
          >
            {pending
              ? '送信中…'
              : isCreate
                ? 'アカウントを作成してログイン'
                : 'ログイン'}
          </button>
        </form>
      </section>
    </main>
  )
}
