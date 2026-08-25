export type ScriptTab = 'ct-script' | 'install-script' | 'metadata-json' | 'standalone-script' | 'docker-compose';

export interface ScriptConfig {
  githubUser: string;
  githubRepo: string;
  branch: string;
  ctId: number;
  hostname: string;
  cores: number;
  memory: number; // in MB
  disk: number; // in GB
  bridge: string;
  ipType: 'dhcp' | 'static';
  staticIp: string;
  gateway: string;
  vlan: string;
  unprivileged: boolean;
  webPort: number;
  syncPort: number;
  authToken: string;
  corsOrigin: string;
  deploymentMode: 'native' | 'docker-lxc';
  enableHttps: boolean;
  domainName: string;
}

export interface AppMetadata {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  repoUrl: string;
  author: string;
  license: string;
  category: string;
  logoSvg: string;
  defaultCpu: number;
  defaultRam: number;
  defaultDisk: number;
  webPort: number;
  syncPort: number;
  tags: string[];
}

export interface GeneratorInput {
  repoUrl: string;
  appName: string;
  slug: string;
  category: string;
  description: string;
  port: number;
  secondaryPort?: number;
  cpu: number;
  ram: number;
  disk: number;
  dockerComposeYaml: string;
  envVars: string;
  deploymentType: 'native-node' | 'docker-compose' | 'native-binary';
}
