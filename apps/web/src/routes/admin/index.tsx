import { honoClient } from '#/honoClient'
import { brand } from '#/brand'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import type { InferResponseType } from 'hono'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

import styles from './admin.module.css'

const $user = honoClient.index.$get
type UserResponse = InferResponseType<typeof $user, 200>

const $adminUsers = honoClient.admin.users.$get
type AdminUsersResponse = InferResponseType<typeof $adminUsers, 200>

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (j.error) return j.error
  } catch {
    /* ignore */
  }
  return res.statusText || `エラー (${res.status})`
}

export const Route = createFileRoute('/admin/')({
  loader: async (): Promise<UserResponse> => {
    const res = await honoClient.index.$get()
    if (res.status === 401) {
      throw redirect({ to: '/', replace: true })
    }
    const data = (await res.json()) as UserResponse
    if (!data.isAdmin) {
      throw redirect({ to: '/', replace: true })
    }
    return data
  },
  component: RouteComponent,
})

function RouteComponent() {
  const sessionUser = Route.useLoaderData()
  const [users, setUsers] = useState<AdminUsersResponse['users']>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [newLoginId, setNewLoginId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newIsAdmin, setNewIsAdmin] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    const res = await honoClient.admin.users.$get()
    setListLoading(false)
    if (!res.ok) {
      setListError(await parseErrorMessage(res))
      return
    }
    const data = (await res.json()) as AdminUsersResponse
    setUsers(data.users)
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    document.title = `${brand.name} - 管理`
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const id = newLoginId.trim()
    if (!id || !newPassword) {
      setFormError('ログインIDとパスワードを入力してください。')
      return
    }
    setCreating(true)
    const res = await honoClient.admin.users.$post({
      json: {
        loginId: id,
        password: newPassword,
        isAdmin: newIsAdmin,
      },
    })
    setCreating(false)
    if (!res.ok) {
      setFormError(await parseErrorMessage(res))
      return
    }
    setNewLoginId('')
    setNewPassword('')
    setNewIsAdmin(false)
    await loadUsers()
  }

  async function onDelete(loginId: string) {
    if (!window.confirm(`ユーザー「${loginId}」を削除しますか？`)) return
    setListError(null)
    setDeletingId(loginId)
    const res = await honoClient.admin.users[':loginId'].$delete({
      param: { loginId },
    })
    setDeletingId(null)
    if (!res.ok) {
      setListError(await parseErrorMessage(res))
      return
    }
    await loadUsers()
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <div>
            <p className={styles.kicker}>{brand.loginKicker}</p>
            <h1 className={styles.title}>{brand.name} - アカウント管理</h1>
            <p className={styles.sub}>
              ログアウトはトップ画面から行えます。
            </p>
          </div>
          <Link to="/" className={styles.back}>
            ログイン画面へ
          </Link>
        </header>

        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="admin-session-heading">
            <h2 id="admin-session-heading" className={styles.cardTitle}>
              セッション
            </h2>
            <div className={styles.row}>
              <span className={styles.loginId}>{sessionUser.loginId}</span>
              <span className={styles.badge}>管理者</span>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="admin-new-user-heading">
            <h2 id="admin-new-user-heading" className={styles.cardTitle}>
              ユーザーを追加
            </h2>
            <form className={styles.form} onSubmit={(e) => void onCreate(e)}>
              {formError ? <p className={styles.alert}>{formError}</p> : null}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="admin-new-login">
                  ログインID
                </label>
                <input
                  id="admin-new-login"
                  className={styles.input}
                  autoComplete="username"
                  value={newLoginId}
                  onChange={(e) => setNewLoginId(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="admin-new-password">
                  パスワード
                </label>
                <input
                  id="admin-new-password"
                  type="password"
                  className={styles.input}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                />
                管理者にする
              </label>
              <div className={styles.actions}>
                <button type="submit" className={styles.btn} disabled={creating}>
                  {creating ? '作成中…' : '作成'}
                </button>
              </div>
            </form>
          </section>

          <section
            className={`${styles.card} ${styles.span2}`}
            aria-labelledby="admin-users-heading"
          >
            <h2 id="admin-users-heading" className={styles.cardTitle}>
              ユーザー一覧
            </h2>
            {listError ? <p className={styles.alert}>{listError}</p> : null}
            {listLoading ? (
              <p className={styles.empty}>読み込み中…</p>
            ) : users.length === 0 ? (
              <p className={styles.empty}>ユーザーがいません。</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">ログインID</th>
                      <th scope="col">権限</th>
                      <th scope="col" className={styles.cellActions}>
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.loginId}>
                        <td className={styles.loginId}>{u.loginId}</td>
                        <td>
                          {u.isAdmin ? (
                            <span className={styles.badge}>管理者</span>
                          ) : (
                            <span className={styles.muted}>一般</span>
                          )}
                        </td>
                        <td className={styles.cellActions}>
                          <button
                            type="button"
                            className={styles.btnDanger}
                            disabled={
                              u.loginId === sessionUser.loginId ||
                              deletingId === u.loginId
                            }
                            onClick={() => void onDelete(u.loginId)}
                          >
                            {deletingId === u.loginId ? '削除中…' : '削除'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
