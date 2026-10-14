import { Navigate, NavLink, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { AppearanceSection } from './AppearanceSection'
import { CategoriesSection } from './CategoriesSection'
import { GeneralSection } from './GeneralSection'
import { ProfileSection } from './ProfileSection'
import { SpacesSection } from './SpacesSection'

const SECTIONS = [
  { slug: 'perfil', label: 'Perfil', Component: ProfileSection },
  { slug: 'aparencia', label: 'Aparência', Component: AppearanceSection },
  { slug: 'espacos', label: 'Espaços', Component: SpacesSection },
  { slug: 'categorias', label: 'Categorias', Component: CategoriesSection },
  { slug: 'preferencias', label: 'Preferências', Component: GeneralSection },
] as const

export function SettingsPage() {
  const { section } = useParams()
  const active = SECTIONS.find((s) => s.slug === section)
  if (!active) return <Navigate to="/configuracoes/perfil" replace />
  const { Component } = active

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid gap-8 md:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Seções de configurações" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-1 md:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.slug} className="shrink-0">
                <NavLink
                  to={`/configuracoes/${s.slug}`}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-secondary font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                    )
                  }
                >
                  {s.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Component />
        </div>
      </div>
    </>
  )
}
