import React, { useState } from 'react';
import { GeneratorInput } from '../types';
import {
  Sparkles,
  Layers,
  FileCode,
  Copy,
  Check,
  Download,
  Terminal,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Cpu,
  HardDrive,
  Zap,
} from 'lucide-react';

const PRESETS = [
  {
    name: 'Mindwtr (GTD Productivity)',
    repoUrl: 'https://github.com/dongdongbh/Mindwtr',
    appName: 'Mindwtr',
    slug: 'mindwtr',
    category: 'Productivity',
    description: 'Privacy-first, local-first Getting Things Done productivity system with cloud sync and Web PWA.',
    port: 5173,
    secondaryPort: 8787,
    cpu: 2,
    ram: 2048,
    disk: 8,
    envVars: 'MINDWTR_CLOUD_AUTH_TOKENS="secret_token"\nPORT=8787\nMINDWTR_CLOUD_CORS_ORIGIN="*"',
    dockerComposeYaml: `services:
  mindwtr-cloud:
    image: node:22-alpine
    ports:
      - "8787:8787"
  mindwtr-app:
    image: nginx:alpine
    ports:
      - "5173:80"`,
  },
  {
    name: 'Uptime Kuma (Monitoring)',
    repoUrl: 'https://github.com/louislam/uptime-kuma',
    appName: 'Uptime Kuma',
    slug: 'uptime-kuma',
    category: 'Monitoring',
    description: 'A fancy self-hosted monitoring tool for websites and network services.',
    port: 3001,
    cpu: 2,
    ram: 2048,
    disk: 8,
    envVars: 'NODE_ENV=production',
    dockerComposeYaml: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "3001:3001"
    volumes:
      - uptime-kuma:/app/data`,
  },
  {
    name: 'IT-Tools (Handy Web Utilities)',
    repoUrl: 'https://github.com/CorentinTh/it-tools',
    appName: 'IT-Tools',
    slug: 'it-tools',
    category: 'Utilities',
    description: 'Collection of handy online tools for developers and people working in IT.',
    port: 8080,
    cpu: 1,
    ram: 1024,
    disk: 4,
    envVars: '',
    dockerComposeYaml: `services:
  it-tools:
    image: corentinth/it-tools:latest
    ports:
      - "8080:80"`,
  },
  {
    name: 'Stirling-PDF (PDF Toolbox)',
    repoUrl: 'https://github.com/Stirling-Tools/Stirling-PDF',
    appName: 'Stirling-PDF',
    slug: 'stirling-pdf',
    category: 'Productivity',
    description: 'Locally hosted web application that allows you to perform various operations on PDF files.',
    port: 8080,
    cpu: 2,
    ram: 2048,
    disk: 10,
    envVars: 'DOCKER_ENABLE_SECURITY=false',
    dockerComposeYaml: `services:
  stirling-pdf:
    image: frooodle/s-pdf:latest
    ports:
      - "8080:8080"`,
  },
];

export const CommunityScriptGenerator: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'ct' | 'install' | 'json' | 'standalone'>('ct');

  const [input, setInput] = useState<GeneratorInput>({
    repoUrl: 'https://github.com/dongdongbh/Mindwtr',
    appName: 'Mindwtr',
    slug: 'mindwtr',
    category: 'Productivity',
    description: 'Privacy-first, local-first Getting Things Done productivity system with cloud sync and Web PWA.',
    port: 5173,
    secondaryPort: 8787,
    cpu: 2,
    ram: 2048,
    disk: 8,
    dockerComposeYaml: `services:\n  mindwtr-cloud:\n    image: node:22-alpine\n    ports:\n      - "8787:8787"\n  mindwtr-app:\n    image: nginx:alpine\n    ports:\n      - "5173:80"`,
    envVars: 'MINDWTR_CLOUD_AUTH_TOKENS="secret_token"\nPORT=8787',
    deploymentType: 'native-node',
  });

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setInput({
      repoUrl: preset.repoUrl,
      appName: preset.appName,
      slug: preset.slug,
      category: preset.category,
      description: preset.description,
      port: preset.port,
      secondaryPort: preset.secondaryPort,
      cpu: preset.cpu,
      ram: preset.ram,
      disk: preset.disk,
      dockerComposeYaml: preset.dockerComposeYaml,
      envVars: preset.envVars,
      deploymentType: 'native-node',
    });
  };

  const handleCopy = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  // Generate scripts for custom app
  const generatedCt = `#!/usr/bin/env bash
source <(curl -s https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
# Copyright (c) 2021-2026 community-scripts ORG
# Author: community-scripts
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: ${input.repoUrl}

APP="${input.appName}"
var_tags="${input.slug};${input.category.toLowerCase()}"
var_cpu="${input.cpu}"
var_ram="${input.ram}"
var_disk="${input.disk}"
var_os="debian"
var_version="12"
var_unprivileged="1"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/${input.slug} ]]; then
    msg_error "No \${APP} Installation Found!"
    exit
  fi
  msg_info "Updating \${APP} LXC Container"
  pct exec $CTID -- bash -c "
    systemctl stop ${input.slug} 2>/dev/null || true
    cd /opt/${input.slug}
    git pull
    systemctl restart ${input.slug}
  "
  msg_ok "Updated Successfully"
  exit
}

start
build_container
description

msg_ok "Completed Successfully!\\n"
echo -e "\${APP} is accessible at: \${BL}http://\${IP}:${input.port}\${CL}"
${input.secondaryPort ? `echo -e "Secondary Endpoint is at: \${BL}http://\${IP}:${input.secondaryPort}\${CL}"` : ''}
`;

  const generatedInstall = `#!/usr/bin/env bash
source /dev/stdin <<< "$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt-get install -y curl sudo mc git jq ca-certificates gnupg nginx build-essential
msg_ok "Installed Dependencies"

msg_info "Setting up Node.js Runtime"
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
$STD apt-get update
$STD apt-get install -y nodejs
msg_ok "Set up Node.js $(node -v)"

msg_info "Cloning ${input.appName} Repository"
mkdir -p /opt/${input.slug}
$STD git clone ${input.repoUrl} /opt/${input.slug}
cd /opt/${input.slug}
msg_ok "Cloned Repository"

msg_info "Configuring Environment"
cat << 'EOF' > /opt/${input.slug}/.env
PORT=${input.port}
${input.envVars}
EOF
msg_ok "Configured Environment"

msg_info "Creating Systemd Service"
cat << 'EOF' > /etc/systemd/system/${input.slug}.service
[Unit]
Description=${input.appName} Self-Hosted Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/${input.slug}
EnvironmentFile=/opt/${input.slug}/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ${input.slug} 2>/dev/null || true
msg_ok "Created and Enabled Systemd Service"

msg_info "Configuring MOTD"
cat << EOF > /etc/motd
===================================================================
  ${input.appName} - Self-Hosted LXC
  * Web Interface: http://\$(hostname -I | awk '{print \$1}'):${input.port}
  * Source Repo: ${input.repoUrl}
===================================================================
EOF
msg_ok "Configured MOTD"

motd_ssh
customize

msg_info "Cleaning up"
$STD apt-get -y autoremove
$STD apt-get -y autoclean
msg_ok "Cleaned up"
`;

  const generatedJson = JSON.stringify(
    {
      name: input.appName,
      slug: input.slug,
      description: input.description,
      categories: [input.category, 'Self-Hosted'],
      type: 'lxc',
      os: 'debian',
      version: '12',
      port: input.port,
      secondary_port: input.secondaryPort,
      resources: {
        cpu: input.cpu,
        ram: input.ram,
        hdd: input.disk,
      },
      website: input.repoUrl,
      install_script: `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/ct/${input.slug}.sh`,
    },
    null,
    2
  );

  const getOutputText = () => {
    switch (activeOutputTab) {
      case 'ct':
        return { code: generatedCt, file: `ct/${input.slug}.sh` };
      case 'install':
        return { code: generatedInstall, file: `install/${input.slug}-install.sh` };
      case 'json':
        return { code: generatedJson, file: `json/${input.slug}.json` };
      case 'standalone':
        return { code: generatedCt, file: `${input.slug}-lxc.sh` };
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Step Tracker */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Community Scripts Workflow Generator</h2>
              <p className="text-xs text-slate-400">
                Transform any open-source Docker/GitHub app into a certified Proxmox VE LXC script.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStep(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentStep === 1
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>1. App Input</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <button
              onClick={() => setCurrentStep(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                currentStep === 2
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>2. Generated LXC Scripts</span>
            </button>
          </div>
        </div>

        {/* Step 1: Input Form */}
        {currentStep === 1 && (
          <div className="pt-6 space-y-6">
            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Quick App Presets
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.slug}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className={`p-3 rounded-xl text-left border transition ${
                      input.slug === preset.slug
                        ? 'bg-orange-500/10 border-orange-500/50 text-white'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{preset.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{preset.repoUrl}</div>
                    <div className="text-[10px] text-orange-400 font-mono mt-1">Port: {preset.port}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">GitHub Repository URL</label>
                  <input
                    type="text"
                    value={input.repoUrl}
                    onChange={(e) => setInput({ ...input, repoUrl: e.target.value })}
                    placeholder="https://github.com/author/repo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-semibold">Application Name</label>
                    <input
                      type="text"
                      value={input.appName}
                      onChange={(e) => setInput({ ...input, appName: e.target.value })}
                      placeholder="My App"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1 font-semibold">Slug (lowercase)</label>
                    <input
                      type="text"
                      value={input.slug}
                      onChange={(e) => setInput({ ...input, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      placeholder="my-app"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-mono focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Primary Port</label>
                    <input
                      type="number"
                      value={input.port}
                      onChange={(e) => setInput({ ...input, port: parseInt(e.target.value) || 80 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Secondary Port</label>
                    <input
                      type="number"
                      value={input.secondaryPort || ''}
                      onChange={(e) => setInput({ ...input, secondaryPort: parseInt(e.target.value) || undefined })}
                      placeholder="Optional"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Category</label>
                    <input
                      type="text"
                      value={input.category}
                      onChange={(e) => setInput({ ...input, category: e.target.value })}
                      placeholder="Productivity"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={input.description}
                    onChange={(e) => setInput({ ...input, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">
                    Docker Compose YAML (or Dockerfile reference)
                  </label>
                  <textarea
                    rows={6}
                    value={input.dockerComposeYaml}
                    onChange={(e) => setInput({ ...input, dockerComposeYaml: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-cyan-300 font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-semibold">Environment Variables (.env)</label>
                  <textarea
                    rows={3}
                    value={input.envVars}
                    onChange={(e) => setInput({ ...input, envVars: e.target.value })}
                    placeholder="KEY=VALUE"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-amber-300 font-mono focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/20 transition"
              >
                <span>Generate Community Scripts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Output View */}
        {currentStep === 2 && (
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveOutputTab('ct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'ct' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ct/{input.slug}.sh
                </button>
                <button
                  onClick={() => setActiveOutputTab('install')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'install' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  install/{input.slug}-install.sh
                </button>
                <button
                  onClick={() => setActiveOutputTab('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeOutputTab === 'json' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  json/{input.slug}.json
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(getOutputText().code, activeOutputTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    copiedTab === activeOutputTab
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {copiedTab === activeOutputTab ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTab === activeOutputTab ? 'Copied' : 'Copy Script'}
                </button>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition"
                >
                  Edit Input
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[500px]">
              <pre>
                <code>{getOutputText().code}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
