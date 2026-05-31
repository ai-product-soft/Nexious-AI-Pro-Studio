import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

// Import all active screens
import DashboardScreen from './screens/DashboardScreen';
import SkillLibraryScreen from './screens/SkillLibraryScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import LeadsScreen from './screens/LeadsScreen';
import AutomationsScreen from './screens/AutomationsScreen';
import SalesMarketingHubScreen from './screens/SalesMarketingHubScreen';
import ReportsScreen from './screens/ReportsScreen';
import FinanceScreen from './screens/FinanceScreen';
import SettingsScreen from './screens/SettingsScreen';
import ResearchScreen from './screens/ResearchScreen';
import ApprovalCenterScreen from './screens/ApprovalCenterScreen';
import { BuildProvider } from './context/BuildContext';

export default function App() {
  const navigate = useNavigate();

  const handleNavigate = (id, state) => {
    navigate(`/${id}`, { state });
  };

  return (
    <BuildProvider>
      <Routes>
        <Route path="/" element={<DashboardScreen onNavigate={handleNavigate} />} />
        <Route path="/dashboard" element={<DashboardScreen onNavigate={handleNavigate} />} />
        
        {/* Under the hood routes */}
        <Route path="/new-build" element={<ResearchScreen onNavigate={handleNavigate} />} />
        <Route path="/build-new" element={<ResearchScreen onNavigate={handleNavigate} />} />
        <Route path="/research" element={<ResearchScreen onNavigate={handleNavigate} />} />
        <Route path="/automations" element={<AutomationsScreen onNavigate={handleNavigate} />} />
        
        {/* Core Sidebar 8 items */}
        <Route path="/products" element={<ProjectsScreen onNavigate={handleNavigate} />} />
        <Route path="/projects" element={<ProjectsScreen onNavigate={handleNavigate} />} />
        <Route path="/leads" element={<LeadsScreen onNavigate={handleNavigate} />} />
        <Route path="/marketing" element={<SalesMarketingHubScreen onNavigate={handleNavigate} />} />
        <Route path="/promotion" element={<SalesMarketingHubScreen onNavigate={handleNavigate} />} />
        <Route path="/sales" element={<SalesMarketingHubScreen onNavigate={handleNavigate} />} />
        <Route path="/sales-marketing" element={<SalesMarketingHubScreen onNavigate={handleNavigate} />} />
        <Route path="/approvals" element={<ApprovalCenterScreen onNavigate={handleNavigate} />} />
        <Route path="/revenue" element={<FinanceScreen onNavigate={handleNavigate} />} />
        <Route path="/finance" element={<FinanceScreen onNavigate={handleNavigate} />} />
        <Route path="/mickii-status" element={<SkillLibraryScreen onNavigate={handleNavigate} />} />
        <Route path="/system-monitor" element={<SkillLibraryScreen onNavigate={handleNavigate} />} />
        
        <Route path="/settings" element={<SettingsScreen onNavigate={handleNavigate} />} />
        <Route path="/analytics" element={<ReportsScreen onNavigate={handleNavigate} />} />
      </Routes>
    </BuildProvider>
  );
}
