const { contextBridge, ipcRenderer } = require('electron');

// 主窗口推送进度；小仪表盘接收进度并可请求还原主窗口
contextBridge.exposeInMainWorld('aipoolDesktop', {
  status: (s) => ipcRenderer.send('aipool:status', s),
  onStatus: (cb) => ipcRenderer.on('aipool:status', (_e, s) => cb(s)),
  restore: () => ipcRenderer.send('aipool:restore'),
  closeMini: () => ipcRenderer.send('aipool:mini-close')
});
