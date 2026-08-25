import React, { useState } from 'react';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ScriptViewer } from './components/ScriptViewer';
import { Configurator } from './components/Configurator';
import { TerminalSimulator } from './components/TerminalSimulator';
import { CommunityScriptGenerator } from './components/CommunityScriptGenerator';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { DownloadModal } from './components/DownloadModal';
import { ScriptConfig } from './types';
import { MINDWTR_METADATA } from './data/mindwtrScriptData';
import { Sliders, Code, Terminal, Sparkles, BookOpen, Layers, CheckCircle2 } from 'lucide-react';

const DEFAULT_CONFIG: ScriptConfig = {
  githubUser: 'dongdongbh',
  githubRepo: 'Mindwtr',
  branch: 'main',
  ctId: 105,
  hostname: 'mindwtr',
  cores: 2,
  memory: 2048,
  disk: 8,
  bridge: 'vmbr0',
  ipType: 'dhcp',
  staticIp: '',
  gateway: '',
  vlan: '',
  unprivileged: true,
  webPort: 5173,
  syncPort: 8787,
  authToken: 'mwt_secret_token_12345',
  corsOrigin: '*',
  deploymentMode: 'native',
  enableHttps: false,
  domainName: '',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'mindwtr' | 'simulator' | 'generator' | 'guide'>('mindwtr');
  const [config, setConfig] = useState<ScriptConfig>(DEFAULT_CONFIG);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <Header activeTab={activeTab} setActiveTab={(tab) => setActiveTab(tab as any)} config={config} />

      {/* Hero Banner with Proxmox Command */}
      <HeroBanner
        config={config}
        onOpenSimulator={() => setActiveTab('simulator')}
        onOpenConfigurator={() => {
          setActiveTab('mindwtr');
          setShowConfigurator(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab 1: Mindwtr Script Hub */}
        {activeTab === 'mindwtr' && (
          <div className="space-y-6">
            {/* Toggle Configurator Bar */}
            <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl p-3 px-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-slate-200">
                  Container Parameters (CTID {config.ctId}, {config.cores} vCPU, {config.memory}MB RAM, {config.disk}GB Disk)
                </span>
              </div>
              <button
                id="toggle-configurator-btn"
                onClick={() => setShowConfigurator(!showConfigurator)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  showConfigurator
                    ? 'bg-orange-500 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {showConfigurator ? 'Hide Settings' : 'Customize Hardware & Auth'}
              </button>
            </div>

            {/* Configurator Drawer */}
            {showConfigurator && (
              <Configurator
                config={config}
                onChange={setConfig}
                onReset={handleResetConfig}
              />
            )}

            {/* Script Code Viewer */}
            <ScriptViewer
              config={config}
              onOpenDownloadModal={() => setShowDownloadModal(true)}
            />
          </div>
        )}

        {/* Tab 2: Terminal Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-orange-400" />
                  Live Proxmox VE Helper-Script Shell Simulator
                </h2>
                <p className="text-xs text-slate-400">
                  Simulate the exact Proxmox terminal output, whiptail prompts, OS provisioning, and service verification before deploying to your homelab.
                </p>
              </div>
              <button
                onClick={() => setShowConfigurator(!showConfigurator)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              >
                Adjust Simulation Config ({config.cores} vCPU / {config.memory}MB)
              </button>
            </div>

            {showConfigurator && (
              <Configurator
                config={config}
                onChange={setConfig}
                onReset={handleResetConfig}
              />
            )}

            <TerminalSimulator config={config} />
          </div>
        )}

        {/* Tab 3: Custom App Generator (Step 1 & Step 2) */}
        {activeTab === 'generator' && (
          <CommunityScriptGenerator />
        )}

        {/* Tab 4: Architecture & Philosophy Guide */}
        {activeTab === 'guide' && (
          <ArchitectureGuide />
        )}
      </main>

      {/* Package Download Modal */}
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        config={config}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Proxmox Helper Scripts Hub</span>
            <span>•</span>
            <span>Compatible with <a href="https://community-scripts.org" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">community-scripts.org</a> standard</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/dongdongbh/Mindwtr"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition"
            >
              Mindwtr GitHub
            </a>
            <a
              href="https://github.com/community-scripts/ProxmoxVE"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition"
            >
              ProxmoxVE GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
