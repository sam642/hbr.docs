import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, Cpu, HardDrive, Zap, Play, Layers } from 'lucide-react';
import { MINDWTR_METADATA } from '../data/mindwtrScriptData';
import { ScriptConfig } from '../types';

interface HeroBannerProps {
  config: ScriptConfig;
  onOpenSimulator: () => void;
  onOpenConfigurator: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  config,
  onOpenSimulator,
  onOpenConfigurator,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);

  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';

  const command = `bash -c "$(wget -qLO - https://raw.githubusercontent.com/${user}/${repo}/${branch}/ct/mindwtr.sh)"`;
  const curlCommand = `bash -c "$(curl -fsSL https://raw.githubusercontent.com/${user}/${repo}/${branch}/install.sh)"`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-900/60 to-slate-950 border-b border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Main Info */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center p-2 shadow-inner">
                <div dangerouslySetInnerHTML={{ __html: MINDWTR_METADATA.logoSvg }} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {MINDWTR_METADATA.name} LXC
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Proxmox VE Helper Script
                  </span>
                </div>
                <p className="text-sm text-slate-400 font-medium">
                  {MINDWTR_METADATA.tagline}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Automated installation script for <strong className="text-slate-100">Mindwtr</strong> (GTD productivity system & sync server) inside an unprivileged Debian 12 LXC container on Proxmox VE. Complies 100% with the <span className="text-orange-400 font-semibold">community-scripts.org</span> standard workflow.
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-1">
              {MINDWTR_METADATA.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Proxmox One-Liner Command Box */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-orange-400" />
                  Run directly from your GitHub Repo:
                </span>
                <span className="text-cyan-400 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {user}/{repo} ({branch})
                </span>
              </div>
              <div className="relative group">
                <div className="bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto shadow-xl pr-28 flex items-center select-all">
                  <span className="text-slate-500 select-none mr-2">$</span>
                  {command}
                </div>
                <button
                  id="copy-hero-command-btn"
                  onClick={() => handleCopy(command)}
                  className={`absolute right-2 top-2 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                    copiedCmd
                      ? 'bg-emerald-500 text-white'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Command
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats & Action Card */}
          <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Default Container Spec
              </span>
              <span className="text-xs text-orange-400 font-mono">Port: {config.webPort} / {config.syncPort}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center text-cyan-400 mb-1">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">{config.cores} vCPU</div>
                <div className="text-[11px] text-slate-400">CPU Cores</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center text-amber-400 mb-1">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">{config.memory} MB</div>
                <div className="text-[11px] text-slate-400">RAM Memory</div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center text-emerald-400 mb-1">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="text-lg font-bold text-white font-mono">{config.disk} GB</div>
                <div className="text-[11px] text-slate-400">Storage Disk</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                id="hero-launch-simulator-btn"
                onClick={onOpenSimulator}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold shadow-lg shadow-orange-500/10 transition"
              >
                <Play className="w-4 h-4 fill-white" />
                Test in Sim Shell
              </button>

              <button
                id="hero-customize-btn"
                onClick={onOpenConfigurator}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-700 transition"
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                Customize Specs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
