const { app, BrowserWindow, Tray, Menu, shell, nativeImage, ipcMain, screen, session } = require('electron');
const path = require('path');

let win = null;
let mini = null;
let tray = null;
let quitting = false;
let miniDismissed = false; // 用户点了小仪表盘的 ×，直到下次最小化前不再显示
let lastStatus = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWin());
}

app.setAppUserModelId('com.aipool.app'); // Windows 通知需要

const preload = path.join(__dirname, 'preload.js');

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function mainHidden() {
  return !win || !win.isVisible() || win.isMinimized();
}

function syncMini() {
  if (!mini || mini.isDestroyed()) return;
  if (mainHidden() && !miniDismissed) {
    if (!mini.isVisible()) mini.showInactive();
  } else if (mini.isVisible()) {
    mini.hide();
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0b0d10',
    title: 'AI协同台',
    icon: path.join(__dirname, 'web', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      webSecurity: false,          // 桌面版绕过跨域限制，所有服务商都能直连
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false  // 最小化/托盘时任务继续全速运行
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'web', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  // 点关闭时缩到托盘，任务不中断；从托盘菜单「退出」才真正退出
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('minimize', () => { miniDismissed = false; syncMini(); });
  win.on('hide', () => { miniDismissed = false; syncMini(); });
  win.on('restore', syncMini);
  win.on('show', syncMini);
}

// 桌面小仪表盘：主窗口最小化或缩到托盘时出现在右下角，始终置顶，可拖动
function createMini() {
  mini = new BrowserWindow({
    width: 340,
    height: 172,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#0b0d10',
    title: 'AI协同台 · 进度',
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false }
  });
  mini.setAlwaysOnTop(true, 'floating');
  mini.setVisibleOnAllWorkspaces(true);
  const { workArea } = screen.getPrimaryDisplay();
  mini.setPosition(workArea.x + workArea.width - 340 - 16, workArea.y + workArea.height - 172 - 16);
  mini.loadFile(path.join(__dirname, 'mini.html'));
  mini.webContents.on('did-finish-load', () => {
    if (lastStatus) mini.webContents.send('aipool:status', lastStatus);
  });
  mini.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mini.hide();
    }
  });
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'web', 'icon-192.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('AI协同台');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: showWin },
    { label: '系统监控', click: () => { showWin(); win.webContents.executeJavaScript("location.hash='mon'"); } },
    { label: '显示进度仪表盘', click: () => { miniDismissed = false; if (mini) mini.showInactive(); } },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWin);
}

ipcMain.on('aipool:status', (_e, s) => {
  lastStatus = s;
  if (mini && !mini.isDestroyed()) mini.webContents.send('aipool:status', s);
  if (win && !win.isDestroyed()) {
    // 任务栏图标上的进度条：运行中显示百分比，停止显示红色，空闲清除
    if (s.busy) win.setProgressBar(Math.max(0.02, (s.pct || 0) / 100), { mode: 'normal' });
    else if (s.stage === 'stop') win.setProgressBar(1, { mode: 'error' });
    else win.setProgressBar(-1);
  }
  if (tray) tray.setToolTip(`AI协同台 · ${s.stageName || '待命'}${s.busy ? ' ' + (s.pct || 0) + '%' : ''}`);
});
ipcMain.on('aipool:restore', showWin);
ipcMain.on('aipool:mini-close', () => {
  miniDismissed = true;
  if (mini) mini.hide();
});

app.whenReady().then(() => {
  // 允许网页发系统通知
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'notifications' || perm === 'clipboard-sanitized-write'));
  createWindow();
  createMini();
  createTray();
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
