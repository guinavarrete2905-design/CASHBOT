import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Ellipsis, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Logo, LogoMark } from '@/components/layout/Logo'
import { NAV_ITEMS, type NavItem } from '@/components/layout/nav'
import { SpaceSwitcher } from '@/components/layout/SpaceSwitcher'
import { usePreferences, type ThemePreference } from '@/features/preferences/api'
import { useProfile } from '@/features/profile/api'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { SpaceProvider } from '@/providers/SpaceProvider'
import { useTheme } from '@/providers/ThemeProvider'

function isActive(item: NavItem, pathname: string) {
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** Aplica o tema salvo no banco quando a sessão carrega em outro dispositivo. */
function ThemeSync() {
  const { data } = usePreferences()
  const { theme, setTheme } = useTheme()
  const stored = data?.theme as ThemePreference | undefined
  useEffect(() => {
    if (stored && stored !== theme) setTheme(stored)
    // Só reage ao valor vindo do banco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored])
  return null
}

function UserFooter() {
  const { user, signOut } = useAuth()
  const { data: profile } = useProfile()
  const name = profile?.full_name?.trim() || user?.email || ''

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      toast.error('Não foi possível sair. Tente de novo.')
    }
  }

  return (
    <div className="flex items-center gap-2 border-t px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {profile?.full_name && <p className="truncate text-xs text-muted-foreground">{user?.email}</p>}
      </div>
      <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair da conta" title="Sair">
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  const { pathname } = useLocation()
  const active = isActive(item, pathname)
  return (
    <NavLink
      to={item.to}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-secondary font-medium text-foreground'
          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <item.icon className={cn('size-[18px]', active && 'text-primary')} aria-hidden="true" />
      {item.label}
    </NavLink>
  )
}

function MobileNav() {
  const { pathname } = useLocation()
  const { signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const primary = NAV_ITEMS.filter((i) => i.primaryOnMobile)
  const secondary = NAV_ITEMS.filter((i) => !i.primaryOnMobile)
  const moreActive = secondary.some((i) => isActive(i, pathname))

  useEffect(() => setMoreOpen(false), [pathname])

  const tabClass = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      active ? 'font-medium text-primary' : 'text-muted-foreground',
    )

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {primary.map((item) => {
            const active = isActive(item, pathname)
            return (
              <li key={item.to} className="flex min-w-0 flex-1">
                <NavLink to={item.to} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
                  <item.icon className="size-5" aria-hidden="true" />
                  <span className="max-w-full truncate px-1">{item.short}</span>
                </NavLink>
              </li>
            )
          })}
          <li className="flex min-w-0 flex-1">
            <button type="button" className={tabClass(moreActive)} onClick={() => setMoreOpen(true)}>
              <Ellipsis className="size-5" aria-hidden="true" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="top-auto bottom-0 max-w-none translate-y-0 rounded-b-none pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:top-1/2 sm:max-w-sm sm:-translate-y-1/2 sm:rounded-b-lg">
          <DialogHeader>
            <DialogTitle>Mais opções</DialogTitle>
            <DialogDescription className="sr-only">Outras áreas do CashBot</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1">
            {secondary.map((item) => (
              <li key={item.to}>
                <SidebarLink item={item} />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => signOut().catch(() => toast.error('Não foi possível sair. Tente de novo.'))}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="size-[18px]" aria-hidden="true" />
                Sair da conta
              </button>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AppShell() {
  return (
    <SpaceProvider>
      <ThemeSync />
      <a
        href="#conteudo"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh">
        {/* Menu lateral — desktop */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-surface lg:flex">
          <div className="px-5 pb-4 pt-5">
            <Logo />
          </div>
          <div className="px-3 pb-3">
            <SpaceSwitcher />
          </div>
          <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3">
            <ul className="grid gap-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} />
                </li>
              ))}
            </ul>
          </nav>
          <UserFooter />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior — celular */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-surface/95 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
            <LogoMark className="size-7" />
            <SpaceSwitcher compact />
          </header>

          <main id="conteudo" className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            <div className="mx-auto w-full max-w-5xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <MobileNav />
    </SpaceProvider>
  )
}
