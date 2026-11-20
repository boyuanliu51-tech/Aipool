const { app, BrowserWindow, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWin());
}

app.setAppUserModelId('com.aipool.app'); // Windows 通知需要

function showWin() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
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
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'web', 'icon-192.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('AI协同台');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: showWin },
    { label: '系统监控', click: () => { showWin(); win.webContents.executeJavaScript("location.hash='mon'"); } },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWin);
}

app.whenReady().then(() => {
  // 允许网页发系统通知
  const ses = require('electron').session.defaultSession;
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'notifications' || perm === 'clipboard-sanitized-write'));
  createWindow();
  createTray();
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
