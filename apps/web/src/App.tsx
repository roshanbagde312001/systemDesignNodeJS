import { CssBaseline, ThemeProvider } from '@mui/material';
import { lazy, useMemo, type ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider, RequireAdmin } from './context/AuthContext';
import { PreferencesProvider, usePreferences } from './context/PreferencesContext';
import { buildTheme } from './theme/theme';

// Every page is its own chunk so visitors only download what they open.
const HomePage = lazy(() => import('./pages/HomePage'));
const SystemDesignsPage = lazy(() => import('./pages/SystemDesignsPage'));
const SystemDesignPage = lazy(() => import('./pages/SystemDesignPage'));
const ConceptsPage = lazy(() => import('./pages/ConceptsPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const PatternsPage = lazy(() => import('./pages/PatternsPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const LearningPathsPage = lazy(() => import('./pages/LearningPathsPage'));
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const GlossaryPage = lazy(() => import('./pages/GlossaryPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminArticlesPage = lazy(() => import('./pages/admin/AdminArticlesPage'));
const AdminArticleEditor = lazy(() => import('./pages/admin/AdminArticleEditor'));
const AdminTaxonomyPage = lazy(() => import('./pages/admin/AdminTaxonomyPage'));
const AdminDesignsPage = lazy(() => import('./pages/admin/AdminDesignsPage'));
const AdminPathsPage = lazy(() => import('./pages/admin/AdminPathsPage'));

function Themed({ children }: { children: ReactNode }) {
  const { colorMode } = usePreferences();
  const theme = useMemo(() => buildTheme(colorMode), [colorMode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="system-designs" element={<SystemDesignsPage />} />
        <Route path="system-design/:slug" element={<SystemDesignPage />} />
        <Route path="concepts" element={<ConceptsPage />} />
        <Route path="concepts/:slug" element={<ArticlePage />} />
        <Route path="patterns" element={<PatternsPage />} />
        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="learning-paths" element={<LearningPathsPage />} />
        <Route path="learning-paths/:slug" element={<LearningPathPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="glossary" element={<GlossaryPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminArticlesPage />} />
          <Route path="articles/new" element={<AdminArticleEditor />} />
          <Route path="articles/:id" element={<AdminArticleEditor />} />
          <Route path="taxonomy" element={<AdminTaxonomyPage />} />
          <Route path="designs" element={<AdminDesignsPage />} />
          <Route path="learning-paths" element={<AdminPathsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <PreferencesProvider>
        <Themed>
          <AuthProvider>{children}</AuthProvider>
        </Themed>
      </PreferencesProvider>
    </HelmetProvider>
  );
}

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  );
}
