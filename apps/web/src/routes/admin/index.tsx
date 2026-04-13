import { honoClient } from '#/honoClient'
import { createFileRoute, redirect } from '@tanstack/react-router'
import type { InferResponseType } from 'hono'

const $user = honoClient.index.$get;
type UserResponse = InferResponseType<typeof $user, 200>

export const Route = createFileRoute('/admin/')({
  component: RouteComponent,
  beforeLoad: async () => {
    const res = await honoClient.index.$get()
    if (res.status === 401) {
      throw redirect({ to: '/', replace: true })
    }
    const data = (await res.json()) as UserResponse
    if (!data.isAdmin) {
      throw redirect({ to: '/', replace: true })
    }
  },
})

function RouteComponent() {
  return <div>Hello "/admin/"!</div>
}
