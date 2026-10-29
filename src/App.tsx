/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { AppLayout } from './components/AppLayout';
import { ProspectingView } from './components/ProspectingView';
import { PipelineView } from './components/PipelineView';
import { ClientProfileView } from './components/ClientProfileView';
import { DashboardView } from './components/DashboardView';
import { DueTodayView } from './components/DueTodayView';

import { ForecastView } from './components/ForecastView';

import { SettingsView } from './components/SettingsView';
import { CampaignsView } from './components/CampaignsView';
import { ProjectsView } from './components/ProjectsView';
import { VoiceNotesView } from './components/VoiceNotesView';
const MemoryView = lazy(() => import('./components/MemoryView').then((m) => ({ default: m.MemoryView })));


/** Every app route needs a session and finished onboarding. */
function RequireAuth() {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0c0e12]" />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || profile.onboarding_step < 4) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProspectingView />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/pipeline/:id" element={<ClientProfileView />} />
          <Route path="/due-today" element={<DueTodayView />} />
          <Route path="/forecast" element={<ForecastView />} />
          <Route path="/campaigns" element={<CampaignsView />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/voice" element={<VoiceNotesView />} />
          <Route path="/memory" element={<Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading memory view...</div>}><MemoryView /></Suspense>} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  );
}
