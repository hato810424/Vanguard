import { Outlet, createRootRoute, useNavigate } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import '../styles.css'
import { useLayoutEffect } from 'react'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    // レンダリング時にリダイレクト
    const navigate = useNavigate()
    useLayoutEffect(() => {
      navigate({ to: '/' })
    }, [])
    return null
  },
})

function RootComponent() {
  return (
    <>
      <Outlet />
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  )
}
