/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { ProspectingView } from './components/ProspectingView';
import { PipelineView } from './components/PipelineView';
import { ClientProfileView } from './components/ClientProfileView';
import { DashboardView } from './components/DashboardView';
import { DueTodayView } from './components/DueTodayView';
import { runBackgroundJobs } from './lib/background';

import { ForecastView } from './components/ForecastView';

import { SettingsView } from './components/SettingsView';
import { Tier1WatchView } from './components/Tier1WatchView';
import { Tier1ProfileView } from './components/Tier1ProfileView';
import { CampaignsView } from './components/CampaignsView';
import { PredictedDemandView } from './components/PredictedDemandView';
import { ProjectsView } from './components/ProjectsView';

import { cleanupCustomerTagsAndExisting } from './lib/cleanupTagsAndExisting';

export default function App() {

  useEffect(() => {
    runBackgroundJobs().catch(console.error);
    cleanupCustomerTagsAndExisting().catch(console.error);
    
    // Auto-clear data once on first load as requested
    const hasCleared = localStorage.getItem('auto_cleared_sample_data');
    if (!hasCleared) {
      import('./lib/backup').then(({ clearAllData }) => {
        clearAllData().then(() => {
          localStorage.setItem('auto_cleared_sample_data', 'true');
          window.location.reload();
        }).catch(console.error);
      }).catch(console.error);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ProspectingView />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/pipeline" element={<PipelineView />} />
          <Route path="/pipeline/:id" element={<ClientProfileView />} />
          <Route path="/tier1" element={<Tier1WatchView />} />
          <Route path="/tier1/:id" element={<Tier1ProfileView />} />
          <Route path="/due-today" element={<DueTodayView />} />
          <Route path="/forecast" element={<ForecastView />} />
          <Route path="/campaigns" element={<CampaignsView />} />
          <Route path="/predicted-demand" element={<PredictedDemandView />} />
          <Route path="/projects" element={<ProjectsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
