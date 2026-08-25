import React from 'react';
import { Terminal, Shield, Cpu, Github, ExternalLink, Sparkles, CheckSquare } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-mono font-bold text-lg">
              &gt;_
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-lg tracking-tight">Proxmox Helper Scripts</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  community-scripts.org
                </span>
              </div>
              <p className="text-xs text-slate-400">Automated LXC Container Deployment Hub</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              id="nav-tab-mindwtr"
              onClick={() => setActiveTab('mindwtr')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'mindwtr'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Mindwtr Script
            </button>

            <button
              id="nav-tab-simulator"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'simulator'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Proxmox Terminal Sim
            </button>

            <button
              id="nav-tab-generator"
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'generator'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Custom App Generator
            </button>

            <button
              id="nav-tab-guide"
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'guide'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4" />
              Standards & Philosophy
            </button>
          </nav>

          {/* Quick links */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/dongdongbh/Mindwtr"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition"
              title="Mindwtr GitHub Repository"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">dongdongbh/Mindwtr</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-2 border-t border-slate-800/60">
          <button
            onClick={() => setActiveTab('mindwtr')}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap ${
              activeTab === 'mindwtr' ? 'bg-orange-500 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Mindwtr Script
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap ${
              activeTab === 'simulator' ? 'bg-orange-500 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Terminal Sim
          </button>
          <button
            onClick={() => setActiveTab('generator')}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap ${
              activeTab === 'generator' ? 'bg-orange-500 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Custom App Generator
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap ${
              activeTab === 'guide' ? 'bg-orange-500 text-white' : 'text-slate-400 bg-slate-900'
            }`}
          >
            Architecture Guide
          </button>
        </div>
      </div>
    </header>
  );
};
