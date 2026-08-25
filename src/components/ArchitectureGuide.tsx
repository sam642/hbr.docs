import React from 'react';
import { ShieldCheck, Cpu, HardDrive, Terminal, GitBranch, RefreshCw, Layers, CheckCircle } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">
              The community-scripts.org Architecture & Philosophy
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Community-Scripts (originally created by tteck and maintained by the open-source community) is the gold standard for deploying lightweight, reproducible, and secure self-hosted applications on Proxmox Virtual Environment.
          </p>
        </div>

        {/* Key Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              1. Unprivileged by Default
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Containers map UID 0 (root inside LXC) to an unprivileged sub-UID on the host (e.g. UID 100000). If compromised, an attacker cannot gain root control of the Proxmox hypervisor.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              2. Native Lean Performance
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Unlike full VMs with heavy kernel virtualization overhead, Linux Containers (LXC) share the host Linux kernel directly, yielding zero-overhead CPU, instant boot times, and tiny RAM footprints.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <RefreshCw className="w-4 h-4" />
              3. Built-In Lifecycle & Update
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every community script features an <code className="text-cyan-300">update_script</code> routine that can be executed directly from the host via <code className="text-cyan-300">pct exec</code> without rebuilding container state.
            </p>
          </div>
        </div>

        {/* Workflow Diagram Breakdown */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-orange-400" />
            Standard Two-Tier Execution Workflow
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ct/ script */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-orange-400">ct/mindwtr.sh</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  Host-Tier
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Sourced into the Proxmox VE root shell</li>
                <li>Pulls <code className="text-slate-200">build.func</code> framework</li>
                <li>Displays interactive Whiptail menu (Default vs Advanced)</li>
                <li>Checks for available storage pool (e.g. <code className="text-slate-200">local-lvm</code>)</li>
                <li>Selects next available CTID (e.g. 105)</li>
                <li>Downloads Debian 12 standard template</li>
                <li>Creates LXC with <code className="text-slate-200">pct create</code> and nesting enabled</li>
                <li>Executes container script via <code className="text-slate-200">pct exec</code></li>
              </ul>
            </div>

            {/* install/ script */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400">install/mindwtr-install.sh</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Container-Tier
                </span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                <li>Runs entirely inside the Debian 12 LXC container</li>
                <li>Sourced with <code className="text-slate-200">install.func</code> helper</li>
                <li>Updates OS packages and checks network reachability</li>
                <li>Installs Node.js 22 LTS & Nginx reverse proxy</li>
                <li>Clones Git repository to <code className="text-slate-200">/opt/mindwtr</code></li>
                <li>Configures environment variables & auth tokens</li>
                <li>Registers <code className="text-slate-200">mindwtr-cloud.service</code> in systemd</li>
                <li>Creates custom MOTD login screen and update scripts</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Mindwtr Specific Details */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Why Mindwtr in LXC?
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Mindwtr is designed with a local-first philosophy. By hosting both the <strong className="text-white">mindwtr-cloud</strong> sync server (REST API for mobile/desktop apps) and the <strong className="text-white">mindwtr-app</strong> Web PWA inside an LXC on Proxmox, you retain 100% data sovereignty without external cloud dependencies.
          </p>
        </div>
      </div>
    </div>
  );
};
