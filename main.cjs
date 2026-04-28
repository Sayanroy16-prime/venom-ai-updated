const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

// IPC Handlers for System Control
ipcMain.handle('system:launch-app', async (event, appName) => {
  console.log(`Launching app: ${appName}`);
  const command = process.platform === 'darwin' ? `open -a "${appName}"` : `start "" "${appName}"`;
  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        console.error(`Failed to launch ${appName}:`, error);
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
});

ipcMain.handle('system:get-info', async () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    uptime: process.uptime()
  };
});

ipcMain.handle('system:open-url', async (event, url) => {
  return shell.openExternal(url);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset', // Makes it look like a native Mac app
    backgroundColor: '#020202',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, 'public/favicon.ico')
  });

  const loadURL = async () => {
    const ports = [3000, 3001, 3002];
    let loaded = false;

    for (const port of ports) {
      const url = isDev ? `http://localhost:${port}` : `file://${path.join(__dirname, 'dist/index.html')}`;
      console.log(`Attempting to load: ${url}`);
      try {
        await win.loadURL(url);
        loaded = true;
        break;
      } catch (e) {
        console.log(`Failed to load on port ${port}`);
      }
    }

    if (!loaded && isDev) {
      console.log('All ports failed, retrying in 2s...');
      setTimeout(loadURL, 2000);
    }
  };

  win.webContents.on('did-fail-load', () => {
    console.log('Page failed to load, retrying...');
    setTimeout(loadURL, 2000);
  });

  loadURL();

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Global Shortcut: Press Cmd+Shift+V to bring Venom to front
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    win.show();
    win.focus();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
