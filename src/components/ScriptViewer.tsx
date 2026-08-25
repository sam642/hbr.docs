import React, { useState } from 'react';
import { ScriptConfig, ScriptTab } from '../types';
import {
  generateCtScript,
  generateInstallScript,
  generateMetadataJson,
  generateStandaloneScript,
  generateDockerComposeConfig,
} from '../data/mindwtrScriptData';
import {
  Copy,
  Check,
  Download,
  FileCode,
  FileJson,
  Layers,
  Terminal,
  ExternalLink,
  Info,
  Package,
  Github,
  Globe,
} from 'lucide-react';

interface ScriptViewerProps {
  config: ScriptConfig;
  onOpenDownloadModal: () => void;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ config, onOpenDownloadModal }) => {
  const [activeTab, setActiveTab] = useState<ScriptTab>('ct-script');
  const [copied, setCopied] = useState(false);
  const [copiedRawUrl, setCopiedRawUrl] = useState(false);

  const user = config.githubUser || 'dongdongbh';
  const repo = config.githubRepo || 'Mindwtr';
  const branch = config.branch || 'main';
  const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/${branch}`;

  const getActiveContent = (): {
    content: string;
    filename: string;
    language: string;
    badge: string;
    desc: string;
    rawUrl?: string;
  } => {
    switch (activeTab) {
      case 'ct-script':
        return {
          content: generateCtScript(config),
          filename: 'ct/mindwtr.sh',
          language: 'bash',
          badge: 'Host Script (In Repo)',
          desc: 'Runs on Proxmox VE host shell. Downloads Debian 12 container and fetches install script directly from your GitHub repo.',
          rawUrl: `${rawBase}/ct/mindwtr.sh`,
        };
      case 'install-script':
        return {
          content: generateInstallScript(config),
          filename: 'install/mindwtr-install.sh',
          language: 'bash',
          badge: 'Container Script (In Repo)',
          desc: 'Runs inside the created LXC container. Installs Node.js 22 LTS, clones your Mindwtr repo, and configures systemd services & Nginx.',
          rawUrl: `${rawBase}/install/mindwtr-install.sh`,
        };
      case 'metadata-json':
        return {
          content: generateMetadataJson(config),
          filename: 'json/mindwtr.json',
          language: 'json',
          badge: 'Metadata Descriptor (In Repo)',
          desc: 'Directory metadata JSON pointing to your custom repository install script URLs.',
          rawUrl: `${rawBase}/json/mindwtr.json`,
        };
      case 'standalone-script':
        return {
          content: generateStandaloneScript(config),
          filename: 'mindwtr-lxc.sh',
          language: 'bash',
          badge: 'Zero-Dependency Standalone (In Repo)',
          desc: 'Single self-contained Bash script with embedded provisioning routines.',
          rawUrl: `${rawBase}/mindwtr-lxc.sh`,
        };
      case 'docker-compose':
        return {
          content: generateDockerComposeConfig(config),
          filename: 'docker-compose.yml',
          language: 'yaml',
          badge: 'Docker Compose Spec',
          desc: 'For Docker-in-LXC or standard Docker VM deployments.',
          rawUrl: `${rawBase}/docker-compose.yml`,
        };
    }
  };

  const { content, filename, language, badge, desc, rawUrl } = getActiveContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRawUrl = () => {
    if (rawUrl) {
      navigator.clipboard.writeText(rawUrl);
      setCopiedRawUrl(true);
      setTimeout(() => setCopiedRawUrl(false), 2000);
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.split('/').pop() || 'script.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-0">
      {/* Top File Tab Selector */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950/70 p-2 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            id="tab-ct-script"
            onClick={() => setActiveTab('ct-script')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'ct-script'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            ct/mindwtr.sh
          </button>

          <button
            id="tab-install-script"
            onClick={() => setActiveTab('install-script')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'install-script'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            install/mindwtr-install.sh
          </button>

          <button
            id="tab-standalone-script"
            onClick={() => setActiveTab('standalone-script')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'standalone-script'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            mindwtr-lxc.sh
          </button>

          <button
            id="tab-metadata-json"
            onClick={() => setActiveTab('metadata-json')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'metadata-json'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            json/mindwtr.json
          </button>

          <button
            id="tab-docker-compose"
            onClick={() => setActiveTab('docker-compose')}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === 'docker-compose'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            docker-compose.yml
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {rawUrl && (
            <button
              id="btn-copy-raw-url"
              onClick={handleCopyRawUrl}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                copiedRawUrl
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700'
              }`}
              title="Copy direct GitHub Raw URL"
            >
              {copiedRawUrl ? <Check className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
              {copiedRawUrl ? 'Raw URL Copied' : 'Copy GitHub Raw URL'}
            </button>
          )}

          <button
            id="btn-copy-code"
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              copied
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Code' : 'Copy Code'}
          </button>

          <button
            id="btn-download-file"
            onClick={handleDownloadFile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Download this file"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>

          <button
            id="btn-download-bundle"
            onClick={onOpenDownloadModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow transition"
          >
            <Package className="w-3.5 h-3.5" />
            Package Bundle
          </button>
        </div>
      </div>

      {/* File Description & GitHub Raw Header */}
      <div className="bg-slate-950/90 px-4 py-2.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="font-mono font-semibold text-white">{filename}</span>
          <span className="hidden sm:inline text-slate-400">— {desc}</span>
        </div>
        <div className="flex items-center gap-2">
          {rawUrl && (
            <span className="text-[11px] font-mono text-cyan-300/80 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 truncate max-w-xs sm:max-w-md">
              {rawUrl}
            </span>
          )}
          <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700 text-[11px] font-medium whitespace-nowrap">
            {badge}
          </span>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="relative bg-slate-950 p-4 font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed text-slate-200">
        <pre className="select-text">
          <code>
            {content.split('\n').map((line, idx) => {
              const lineNum = idx + 1;
              let isComment = line.trim().startsWith('#');
              let isHeader = line.includes('===') || line.includes('msg_info') || line.includes('msg_ok');
              let isVar = line.includes('=') && !line.includes('==') && !line.trim().startsWith('#');

              return (
                <div key={idx} className="table-row hover:bg-slate-900/50">
                  <span className="table-cell pr-4 text-right select-none text-slate-600 text-[11px] w-10">
                    {lineNum}
                  </span>
                  <span
                    className={`table-cell whitespace-pre ${
                      isComment
                        ? 'text-slate-500 italic'
                        : isHeader
                        ? 'text-amber-300 font-semibold'
                        : isVar
                        ? 'text-cyan-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {line}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
};
