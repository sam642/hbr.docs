import React, { useState } from 'react';
import { ScriptConfig } from '../types';
import { Settings, RefreshCw, Key, Shield, Network, Server, HardDrive, Cpu, Github, Check, Copy, ExternalLink } from 'lucide-react';

interface ConfiguratorProps {
  config: ScriptConfig;
  onChange: (config: ScriptConfig) => void;
  onReset: () => void;
}

export const Configurator: React.FC<ConfiguratorProps> = ({ config, onChange, onReset }) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    let result = 'mwt_';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onChange({ ...config, authToken: result });
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Settings className="w-4 h-4 text-orange-400" />
          <span>Interactive Script Configurator</span>
        </div>
        <button
          id="config-reset-btn"
          onClick={onReset}
          className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition"
        >
          <RefreshCw className="w-3 h-3" />
          Reset Defaults
        </button>
      </div>

      {/* GitHub Repository Target Card */}
      <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-cyan-400 tracking-wider">
            <Github className="w-4 h-4" />
            GitHub Repository Target (Your Script Host)
          </div>
          <span className="text-[11px] text-slate-400">
            Allows running scripts directly from your own GitHub repository
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">GitHub User / Org</label>
            <input
              id="cfg-github-user"
              type="text"
              value={config.githubUser}
              onChange={(e) => onChange({ ...config, githubUser: e.target.value.trim() })}
              placeholder="e.g. your-github-username"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Repository Name</label>
            <input
              id="cfg-github-repo"
              type="text"
              value={config.githubRepo}
              onChange={(e) => onChange({ ...config, githubRepo: e.target.value.trim() })}
              placeholder="e.g. Mindwtr"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Branch</label>
            <input
              id="cfg-github-branch"
              type="text"
              value={config.branch}
              onChange={(e) => onChange({ ...config, branch: e.target.value.trim() })}
              placeholder="main"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Direct Raw URLs Preview */}
        <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 space-y-2">
          <div className="text-[11px] font-semibold text-slate-400">Direct GitHub Raw Endpoints for Proxmox:</div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950 p-2 rounded border border-slate-800/80">
            <div className="font-mono text-xs text-cyan-300 truncate">
              {rawBase}/ct/mindwtr.sh
            </div>
            <button
              onClick={() => handleCopy(`${rawBase}/ct/mindwtr.sh`, 'ct')}
              className="flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
            >
              {copiedUrl === 'ct' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedUrl === 'ct' ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Container Basics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            LXC Identifier
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Container ID (CTID)</label>
              <input
                id="cfg-ctid"
                type="number"
                value={config.ctId}
                onChange={(e) => onChange({ ...config, ctId: parseInt(e.target.value) || 100 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Hostname</label>
              <input
                id="cfg-hostname"
                type="text"
                value={config.hostname}
                onChange={(e) => onChange({ ...config, hostname: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Security Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...config, unprivileged: true })}
                className={`flex-1 text-xs py-1.5 px-2 rounded-lg border font-medium transition ${
                  config.unprivileged
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Unprivileged (Rec.)
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...config, unprivileged: false })}
                className={`flex-1 text-xs py-1.5 px-2 rounded-lg border font-medium transition ${
                  !config.unprivileged
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                Privileged
              </button>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            Hardware Allocation
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Cores</label>
              <select
                id="cfg-cores"
                value={config.cores}
                onChange={(e) => onChange({ ...config, cores: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value={1}>1 Core</option>
                <option value={2}>2 Cores (Rec.)</option>
                <option value={4}>4 Cores</option>
                <option value={8}>8 Cores</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">RAM (MB)</label>
              <select
                id="cfg-ram"
                value={config.memory}
                onChange={(e) => onChange({ ...config, memory: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value={1024}>1024 MB</option>
                <option value={2048}>2048 MB (Rec.)</option>
                <option value={4096}>4096 MB</option>
                <option value={8192}>8192 MB</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Disk (GB)</label>
              <select
                id="cfg-disk"
                value={config.disk}
                onChange={(e) => onChange({ ...config, disk: parseInt(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none"
              >
                <option value={4}>4 GB</option>
                <option value={8}>8 GB (Rec.)</option>
                <option value={16}>16 GB</option>
                <option value={32}>32 GB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Proxmox Network Bridge</label>
            <input
              id="cfg-bridge"
              type="text"
              value={config.bridge}
              onChange={(e) => onChange({ ...config, bridge: e.target.value })}
              placeholder="vmbr0"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Ports & Security */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            Mindwtr Cloud Auth & Ports
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Web Client Port</label>
              <input
                id="cfg-web-port"
                type="number"
                value={config.webPort}
                onChange={(e) => onChange({ ...config, webPort: parseInt(e.target.value) || 5173 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Sync Server Port</label>
              <input
                id="cfg-sync-port"
                type="number"
                value={config.syncPort}
                onChange={(e) => onChange({ ...config, syncPort: parseInt(e.target.value) || 8787 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-300">Cloud Sync Auth Token</label>
              <button
                type="button"
                onClick={generateRandomToken}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
              >
                Generate New
              </button>
            </div>
            <input
              id="cfg-auth-token"
              type="text"
              value={config.authToken}
              onChange={(e) => onChange({ ...config, authToken: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
