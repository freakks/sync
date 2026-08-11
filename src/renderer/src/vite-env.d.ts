/// <reference types="vite/client" />

interface Window {
  api: {
    getSteamPath: () => Promise<{ steamRoot: string; userdata: string } | { error: string }>;
    getAccounts: () => Promise<string[]>;
    fetchNicknames: (ids: string[]) => Promise<Record<string, { name: string; avatar: string | null; level: number | null }>>;
    checkFolder: (data: { userdata: string; srcId: string }) => Promise<{ exists: boolean }>;
    checkUmbrella: () => Promise<{ exists: boolean }>;
    launchUmbrella: () => Promise<{ ok: boolean; error?: string }>;
    doTransfer: (data: { srcId: string; dstId: string; userdata: string }) => Promise<{ ok: boolean; error?: string }>;
    killSteam: () => Promise<string[]>;
    startSteam: (root: string) => Promise<boolean>;
    getSettings: () => Promise<{ launchMode?: string }>;
    saveSettings: (settings: { launchMode: string }) => Promise<void>;
    hideWindow: () => Promise<void>;
    openTelegram: () => Promise<void>;
  };
}