import React, { useState, useEffect, useRef } from 'react';
import { ScriptConfig } from '../types';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  Terminal,
  Maximize2,
  Check,
  AlertCircle,
  ExternalLink,
  FastForward,
  Pause,
} from 'lucide-react';

interface TerminalSimulatorProps {
  config: ScriptConfig;
}

interface LogLine {
  id: string;
  type: 'cmd' | 'info' | 'ok' | 'warn' | 'error' | 'whiptail' | 'raw';
  text: string;
  timestamp: string;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({ config }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [showWhiptailPrompt, setShowWhiptailPrompt] = useState(false);
  const [whiptailMode, setWhiptailMode] = useState<'default' | 'advanced'>('default');
  const [simulatedIp, setSimulatedIp] = useState('192.168.1.185');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const token = config.authToken || 'mwt_live_89419481948';
  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';

  const addLog = (type: LogLine['type'], text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { id: Math.random().toString(), type, text, timestamp: time }]);
  };

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, showWhiptailPrompt]);

  const simulationSteps = [
    {
      action: () => {
        addLog('cmd', `root@pve:~# bash -c "$(wget -qLO - https://raw.githubusercontent.com/${user}/${repo}/${branch}/ct/mindwtr.sh)"`);
        addLog('raw', `
===================================================================
   __  __ _           _          _       
  |  \\/  (_)_ __   __| |_      _| |_ _ __ 
  | |\\/| | | '_ \\ / _\` \\ \\ /\\ / / __| '__|
  | |  | | | | | | (_| |\\ V  V /| |_| |   
  |_|  |_|_|_| |_|\\__,_| \\_/\\_/  \\__|_|   
===================================================================
   Mindwtr LXC Helper-Script (Host Builder)
   Source: https://github.com/${user}/${repo} (${branch})
===================================================================`);
        setShowWhiptailPrompt(true);
      },
      delay: 500,
      waitForInput: true,
    },
    {
      action: () => {
        addLog('info', `Loading build.func helper engine...`);
        addLog('info', `Checking Proxmox VE node environment: PVE 8.3-3 (kernel 6.8.12-5-pve)`);
        addLog('ok', `Verified Proxmox VE Host`);
      },
      delay: 800,
    },
    {
      action: () => {
        addLog('info', `Detecting default storage pool...`);
        addLog('ok', `Storage local-lvm available with 240.5 GB free space`);
        addLog('info', `Resolving next available Container ID...`);
        addLog('ok', `Allocated CT ID: ${config.ctId}`);
      },
      delay: 900,
    },
    {
      action: () => {
        addLog('info', `[1/6] Checking Debian 12 (Bookworm) standard template cache...`);
        addLog('info', `Template found: local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst`);
        addLog('ok', `Validated OS Template`);
      },
      delay: 800,
    },
    {
      action: () => {
        addLog(
          'info',
          `[2/6] Creating Unprivileged LXC Container #${config.ctId} (hostname: ${config.hostname}, cores: ${config.cores}, RAM: ${config.memory}MB, disk: ${config.disk}GB, bridge: ${config.bridge})...`
        );
        addLog('ok', `Created LXC container CT ${config.ctId}`);
      },
      delay: 1200,
    },
    {
      action: () => {
        addLog('info', `[3/6] Starting Container ${config.ctId} & awaiting DHCP network negotiation...`);
        addLog('ok', `Container #${config.ctId} is running with state: RUNNING`);
        addLog('ok', `Assigned IPv4: ${simulatedIp} (eth0 on bridge ${config.bridge})`);
      },
      delay: 1100,
    },
    {
      action: () => {
        addLog('info', `[4/6] Updating Container OS packages & installing essential dependencies...`);
        addLog('raw', `    * apt-get update && apt-get install curl sudo mc git jq ca-certificates gnupg nginx build-essential`);
        addLog('ok', `Installed base dependencies (14 packages added)`);
      },
      delay: 1400,
    },
    {
      action: () => {
        addLog('info', `Setting up Node.js 22 LTS Runtime via NodeSource official GPG repository...`);
        addLog('ok', `Installed Node.js v22.14.0 (npm v10.9.2)`);
      },
      delay: 1000,
    },
    {
      action: () => {
        addLog('info', `[5/6] Cloning https://github.com/${user}/${repo}.git into /opt/mindwtr...`);
        addLog('ok', `Cloned Mindwtr repository (branch: ${branch})`);
        addLog('info', `Configuring Mindwtr Cloud Sync server on port ${config.syncPort}...`);
        addLog('ok', `Generated auth tokens and created /opt/mindwtr/.env`);
      },
      delay: 1300,
    },
    {
      action: () => {
        addLog('info', `Building Web PWA Client & configuring Nginx reverse proxy on port ${config.webPort}...`);
        addLog('ok', `Configured Nginx site /etc/nginx/sites-enabled/mindwtr`);
        addLog('info', `Registering systemd unit: mindwtr-cloud.service`);
        addLog('ok', `Enabled and started mindwtr-cloud.service & nginx.service`);
      },
      delay: 1200,
    },
    {
      action: () => {
        addLog('info', `[6/6] Generating MOTD login banner & update helper /usr/local/bin/update-mindwtr...`);
        addLog('ok', `Configured MOTD and SSH auto-summary`);
        addLog('info', `Cleaning up temporary apt caches...`);
        addLog('ok', `Cleanup complete!`);
        addLog(
          'raw',
          `
\x1b[32m===================================================================\x1b[0m
\x1b[32m✔ Mindwtr LXC Container #${config.ctId} Deployment Completed Successfully!\x1b[0m
\x1b[32m===================================================================\x1b[0m

  \x1b[36m• Mindwtr Web Client (PWA):\x1b[0m    http://${simulatedIp}:${config.webPort}
  \x1b[36m• Cloud Sync & REST API:\x1b[0m       http://${simulatedIp}:${config.syncPort}
  \x1b[36m• Cloud Health Check:\x1b[0m          http://${simulatedIp}:${config.syncPort}/health
  \x1b[36m• Cloud Sync Secret Token:\x1b[0m     ${token}

  \x1b[33m• To Update in future:\x1b[0m          Run update-mindwtr inside LXC or rerun ct/mindwtr.sh
\x1b[32m===================================================================\x1b[0m`
        );
      },
      delay: 800,
    },
  ];

  const handleStartSimulation = () => {
    setLogs([]);
    setIsRunning(true);
    setCurrentStepIndex(0);
    simulationSteps[0].action();
  };

  const handleWhiptailChoice = (mode: 'default' | 'advanced') => {
    setWhiptailMode(mode);
    setShowWhiptailPrompt(false);
    addLog('whiptail', `[Whiptail Dialog Selection]: User selected "${mode === 'default' ? 'Default Settings (Auto)' : 'Advanced Custom Settings'}"`);
    proceedNextStep(1);
  };

  const proceedNextStep = (nextIdx: number) => {
    if (nextIdx >= simulationSteps.length) {
      setIsRunning(false);
      return;
    }

    setCurrentStepIndex(nextIdx);
    const step = simulationSteps[nextIdx];

    setTimeout(() => {
      step.action();
      if (!step.waitForInput) {
        proceedNextStep(nextIdx + 1);
      }
    }, step.delay);
  };

  const handleReset = () => {
    setLogs([]);
    setIsRunning(false);
    setShowWhiptailPrompt(false);
    setCurrentStepIndex(-1);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0">
      {/* Terminal Bar */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-orange-400" />
            root@pve:~# (Proxmox VE Interactive Simulator)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && logs.length === 0 && (
            <button
              id="sim-start-btn"
              onClick={handleStartSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Simulate Execution
            </button>
          )}

          {logs.length > 0 && (
            <button
              id="sim-restart-btn"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Console
            </button>
          )}
        </div>
      </div>

      {/* Terminal Screen */}
      <div className="bg-black p-4 font-mono text-xs text-slate-200 min-h-[480px] max-h-[580px] overflow-y-auto leading-relaxed relative">
        {logs.length === 0 && !isRunning && (
          <div className="h-80 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Terminal className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-bold text-white">Interactive Proxmox Shell Simulator</h3>
              <p className="text-xs text-slate-400">
                Experience the exact execution flow of the Community Script before running it on your production Proxmox host.
              </p>
            </div>
            <button
              onClick={handleStartSimulation}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-orange-500/20 transition"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Launch Simulation Run
            </button>
          </div>
        )}

        {/* Log Entries */}
        {logs.map((log) => {
          let prefix = '';
          let colorClass = 'text-slate-300';

          if (log.type === 'cmd') {
            colorClass = 'text-cyan-400 font-bold';
          } else if (log.type === 'info') {
            prefix = '[INFO] ';
            colorClass = 'text-sky-300';
          } else if (log.type === 'ok') {
            prefix = '[✔ OK] ';
            colorClass = 'text-emerald-400 font-semibold';
          } else if (log.type === 'warn') {
            prefix = '[WARN] ';
            colorClass = 'text-amber-400';
          } else if (log.type === 'whiptail') {
            colorClass = 'text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40 inline-block my-1';
          }

          return (
            <div key={log.id} className="my-1 whitespace-pre-wrap">
              <span className={colorClass}>
                {prefix}
                {log.text}
              </span>
            </div>
          );
        })}

        {/* Interactive Whiptail Dialog Box Overlay Simulation */}
        {showWhiptailPrompt && (
          <div className="my-4 p-4 max-w-lg mx-auto bg-blue-900 border-2 border-slate-300 shadow-2xl rounded text-slate-100 animate-in fade-in">
            <div className="bg-slate-300 text-blue-950 font-bold px-2 py-0.5 text-center text-xs uppercase mb-3">
              Proxmox VE Helper-Scripts: Mindwtr Setup
            </div>
            <p className="text-xs mb-4 text-center leading-relaxed font-sans">
              This will create a New <strong className="text-amber-300">Mindwtr LXC Container</strong>.
              <br />
              Proceed using Default Settings?
              <br />
              <span className="text-[11px] text-blue-200 block mt-1">
                (Default: Debian 12, {config.cores} vCPU, {config.memory}MB RAM, {config.disk}GB Disk)
              </span>
            </p>
            <div className="flex justify-center gap-4">
              <button
                id="whiptail-btn-yes"
                onClick={() => handleWhiptailChoice('default')}
                className="bg-slate-200 hover:bg-white text-blue-950 font-bold px-4 py-1.5 text-xs rounded border border-slate-400 shadow transition"
              >
                &lt; Yes (Default) &gt;
              </button>
              <button
                id="whiptail-btn-advanced"
                onClick={() => handleWhiptailChoice('advanced')}
                className="bg-blue-950 hover:bg-blue-800 text-white font-bold px-4 py-1.5 text-xs rounded border border-slate-300 shadow transition"
              >
                &lt; Advanced Settings &gt;
              </button>
            </div>
          </div>
        )}

        {/* Live Terminal Prompt cursor */}
        {isRunning && !showWhiptailPrompt && (
          <div className="flex items-center gap-2 mt-2 text-cyan-400">
            <span className="animate-spin inline-block">⠋</span>
            <span className="text-slate-400 text-[11px]">Executing automated LXC provisioning steps...</span>
          </div>
        )}

        {/* Clickable final result box once finished */}
        {!isRunning && logs.length > 5 && (
          <div className="mt-4 p-4 bg-slate-900/90 border border-emerald-500/40 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Container #{config.ctId} Online & Healthy
              </span>
              <span className="text-[11px] text-slate-400 font-mono">{simulatedIp}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">Web PWA Interface</div>
                <a
                  href={`http://${simulatedIp}:${config.webPort}`}
                  onClick={(e) => e.preventDefault()}
                  className="text-cyan-400 font-bold hover:underline flex items-center gap-1"
                >
                  http://{simulatedIp}:{config.webPort}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">Cloud Sync REST API</div>
                <div className="text-amber-400 font-bold font-mono">
                  http://{simulatedIp}:{config.syncPort}/health
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
