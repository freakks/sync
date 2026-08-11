import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getSteamPath: () => ipcRenderer.invoke("get-steam-path"),
  getAccounts: () => ipcRenderer.invoke("get-accounts"),
  fetchNicknames: (ids: string[]) => ipcRenderer.invoke("fetch-nicknames", ids),
  checkFolder: (data: { userdata: string; srcId: string }) => ipcRenderer.invoke("check-folder", data),
  checkUmbrella: () => ipcRenderer.invoke("check-umbrella"),
  launchUmbrella: () => ipcRenderer.invoke("launch-umbrella"),
  doTransfer: (data: { srcId: string; dstId: string; userdata: string }) => ipcRenderer.invoke("do-transfer", data),
  killSteam: () => ipcRenderer.invoke("kill-steam"),
  startSteam: (root: string) => ipcRenderer.invoke("start-steam", root),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: { launchMode: string }) => ipcRenderer.invoke("save-settings", settings),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  openTelegram: () => ipcRenderer.invoke("open-telegram"),
});