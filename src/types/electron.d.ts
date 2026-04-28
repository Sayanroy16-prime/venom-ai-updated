export interface ElectronBridge {
  launchApp: (appName: string) => Promise<boolean>;
  getSystemInfo: () => Promise<{
    platform: string;
    arch: string;
    version: string;
    uptime: number;
  }>;
  openUrl: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronBridge;
  }
}
