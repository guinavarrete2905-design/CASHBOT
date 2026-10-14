import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AuthProvider } from '@/providers/AuthProvider'
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider'
import { AppRoutes } from '@/routes/AppRoutes'
import { ConfigMissingPage } from '@/routes/ConfigMissingPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="top-center" richColors closeButton />
}

export function App() {
  return (
    <ThemeProvider>
      {isSupabaseConfigured ? (
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      ) : (
        <ConfigMissingPage />
      )}
      <ThemedToaster />
    </ThemeProvider>
  )
}
