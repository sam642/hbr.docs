import React from 'react';
import { ScriptConfig } from '../types';
import {
  generateCtScript,
  generateInstallScript,
  generateMetadataJson,
  generateStandaloneScript,
  generateDockerComposeConfig,
} from '../data/mindwtrScriptData';
import { X, Download, FileCode, FileJson, Package, Check, Copy } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ScriptConfig;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose, config }) => {
  if (!isOpen) return null;

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const files = [
    {
      name: 'ct/mindwtr.sh',
      content: generateCtScript(config),
      filename: 'mindwtr.sh',
      desc: 'Host Proxmox LXC builder script',
      icon: FileCode,
    },
    {
      name: 'install/mindwtr-install.sh',
      content: generateInstallScript(config),
      filename: 'mindwtr-install.sh',
      desc: 'In-container Debian 12 setup script',
      icon: FileCode,
    },
    {
      name: 'json/mindwtr.json',
      content: generateMetadataJson(config),
      filename: 'mindwtr.json',
      desc: 'Community-scripts directory catalog JSON',
      icon: FileJson,
    },
    {
      name: 'mindwtr-standalone.sh',
      content: generateStandaloneScript(config),
      filename: 'mindwtr-standalone.sh',
      desc: 'Zero-dependency standalone Proxmox script',
      icon: Package,
    },
    {
      name: 'docker-compose.yml',
      content: generateDockerComposeConfig(config),
      filename: 'docker-compose.yml',
      desc: 'Docker Compose configuration file',
      icon: FileCode,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-white font-bold">
            <Package className="w-5 h-5 text-orange-400" />
            <span>Download Mindwtr LXC Script Package</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-300">
            Download individual files or inspect them for your Proxmox VE cluster or community-scripts repository submission.
          </p>

          <div className="space-y-2">
            {files.map((file) => {
              const Icon = file.icon;
              return (
                <div
                  key={file.name}
                  className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-white">{file.name}</div>
                      <div className="text-[11px] text-slate-400">{file.desc}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => downloadFile(file.content, file.filename)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-orange-500 text-slate-200 hover:text-white transition shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
