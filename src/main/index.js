const { app, ipcMain, session, Menu, clipboard, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const windowManager = require('./window-manager');

let mainWindow;
let currentZoomFactor = 1.0;

// Load selectors for file injection
const selectorsPath = path.join(__dirname, '../../config/selectors.json');
let selectors = {};
try {
  selectors = JSON.parse(fs.readFileSync(selectorsPath, 'utf8'));
} catch (e) {
  console.error('Failed to load selectors for file injection:', e);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Clipboard save/restore ---

function saveClipboard() {
  return {
    text: clipboard.readText(),
    html: clipboard.readHTML(),
    rtf: clipboard.readRTF(),
    image: clipboard.readImage(),
  };
}

function restoreClipboard(saved) {
  if (saved.image && !saved.image.isEmpty()) {
    clipboard.writeImage(saved.image);
  } else if (saved.html && saved.html.length > 0) {
    clipboard.write({ text: saved.text, html: saved.html, rtf: saved.rtf });
  } else if (saved.text && saved.text.length > 0) {
    clipboard.writeText(saved.text);
  } else {
    clipboard.clear();
  }
}

// --- Upload completion detection ---

async function waitForUploadComplete(view, providerKey, timeout = 20000) {
  const submitSels = selectors[providerKey]?.submit || [];

  // Phase 1: Wait for upload to begin (provider needs time to start processing)
  await delay(2000);

  // Phase 2: Poll until no progress indicators are visible AND send button is enabled
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const status = await view.webContents.executeJavaScript(`
      (function() {
        // Check for active progress indicators
        var progressEls = document.querySelectorAll(
          'progress, [role="progressbar"], [aria-busy="true"], ' +
          '[class*="CircularProgress"], [class*="upload-progress"], ' +
          'svg[class*="animate-spin"], [class*="loading"]'
        );
        for (var i = 0; i < progressEls.length; i++) {
          var r = progressEls[i].getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.width < 200) return 'uploading';
        }

        // Check if send button exists and is enabled
        var submitSels = ${JSON.stringify(submitSels)};
        for (var j = 0; j < submitSels.length; j++) {
          var btn = document.querySelector(submitSels[j]);
          if (btn) {
            if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return 'button-disabled';
            return 'ready';
          }
        }

        return 'ready';
      })();
    `);

    console.log('[FileInject] ' + providerKey + ' upload status: ' + status);
    if (status === 'ready') return true;
    await delay(500);
  }

  console.warn('[FileInject] ' + providerKey + ' upload wait timed out');
  return false;
}

// --- File injection helpers ---

async function injectImageViaClipboard(view, imageBase64, providerKey) {
  const buffer = Buffer.from(imageBase64, 'base64');
  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) {
    console.warn('[FileInject] Failed to create nativeImage from buffer');
    return false;
  }

  // Focus the input element first so paste has a target
  const inputSels = selectors[providerKey]?.input || [];
  try {
    await view.webContents.executeJavaScript(`
      (function() {
        var sels = ${JSON.stringify(inputSels)};
        for (var i = 0; i < sels.length; i++) {
          var el = document.querySelector(sels[i]);
          if (el) { el.focus(); el.click(); return true; }
        }
        return false;
      })();
    `);
  } catch (e) {
    console.warn('[FileInject] Failed to focus input:', e);
  }

  await delay(100);
  clipboard.writeImage(img);
  view.webContents.paste();
  await delay(500);
  return true;
}

async function injectFileViaExecuteJS(view, file, providerKey) {
  const fileInputSelectors = selectors[providerKey]?.fileInput || [];
  const inputSelectors = selectors[providerKey]?.input || [];

  const safeName = file.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeType = file.type.replace(/'/g, "\\'");

  const script = `
    (function() {
      try {
        var base64 = '${file.base64}';
        var bytes = atob(base64);
        var arr = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        var f = new File([arr], '${safeName}', { type: '${safeType}' });
        var dt = new DataTransfer();
        dt.items.add(f);

        // Strategy 1: Find file input using provider-specific selectors
        var fileInputSels = ${JSON.stringify(fileInputSelectors)};
        for (var si = 0; si < fileInputSels.length; si++) {
          var fi = document.querySelector(fileInputSels[si]);
          if (fi) {
            fi.files = dt.files;
            fi.dispatchEvent(new Event('change', { bubbles: true }));
            return 'file-input-specific';
          }
        }

        // Strategy 2: Find any input[type=file] on the page
        var allFileInputs = document.querySelectorAll('input[type="file"]');
        for (var j = 0; j < allFileInputs.length; j++) {
          allFileInputs[j].files = dt.files;
          allFileInputs[j].dispatchEvent(new Event('change', { bubbles: true }));
          return 'file-input-generic';
        }

        // Strategy 3: Synthetic paste event with mock clipboardData
        var inpSels = ${JSON.stringify(inputSelectors)};
        for (var k = 0; k < inpSels.length; k++) {
          var inp = document.querySelector(inpSels[k]);
          if (inp) {
            inp.focus();
            var mockClipboard = {
              items: [{ kind: 'file', type: f.type, getAsFile: function() { return f; } }],
              files: dt.files,
              getData: function() { return ''; },
              types: ['Files']
            };
            var pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
            Object.defineProperty(pasteEvent, 'clipboardData', { value: mockClipboard });
            inp.dispatchEvent(pasteEvent);
            return 'paste-event';
          }
        }

        return 'no-target-found';
      } catch(e) {
        return 'error: ' + e.message;
      }
    })();
  `;

  try {
    const result = await view.webContents.executeJavaScript(script);
    console.log(`[FileInject] ${providerKey}: ${result}`);
    return result;
  } catch (err) {
    console.error(`[FileInject] ${providerKey} failed:`, err);
    return 'error';
  }
}

app.on('ready', async () => {
  // Handle permissions for media (microphone)
  session.fromPartition('persist:shared').setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'clipboard-read' || permission === 'clipboard-write' || permission === 'clipboard-sanitized-write') {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.fromPartition('persist:shared').setPermissionCheckHandler((webContents, permission, origin) => {
    if (permission === 'media' || permission === 'clipboard-read' || permission === 'clipboard-write' || permission === 'clipboard-sanitized-write') {
      return true;
    }
    return false;
  });

  // Create standard application menu for macOS compatibility (Copy/Paste shortcuts)
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow = await windowManager.createWindow();

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();

  // IPC handler for text updates from renderer
  ipcMain.handle('send-text-update', async (event, text) => {
    const supersizedPosition = mainWindow.getSupersizedPosition ? mainWindow.getSupersizedPosition() : null;

    // If supersized, only send to that position
    if (supersizedPosition) {
      const view = mainWindow.viewPositions[supersizedPosition];
      if (view && view.webContents) {
        view.webContents.send('text-update', text);
      }
    } else {
      // Send text to all positions
      windowManager.POSITIONS.forEach(pos => {
        const view = mainWindow.viewPositions[pos];
        if (view && view.webContents) {
          view.webContents.send('text-update', text);
        }
      });
    }
  });

  ipcMain.handle('selector-error', async (event, source, error) => {
    if (mainWindow.mainView && mainWindow.mainView.webContents) {
      mainWindow.mainView.webContents.send('selector-error', { source, error });
    }
  });

  ipcMain.handle('rescan-selectors', async (event) => {
    windowManager.POSITIONS.forEach(pos => {
      const view = mainWindow.viewPositions[pos];
      if (view && view.webContents) {
        view.webContents.reload();
      }
    });
    return true;
  });

  ipcMain.handle('refresh-pages', async (event) => {
    const reloadPromises = windowManager.POSITIONS.map(pos => {
      return new Promise((resolve) => {
        const view = mainWindow.viewPositions[pos];
        if (view && view.webContents) {
          const onLoad = () => {
            view.webContents.setZoomFactor(currentZoomFactor);
            view.webContents.removeListener('did-finish-load', onLoad);
            resolve();
          };
          view.webContents.on('did-finish-load', onLoad);
          view.webContents.reload();
        } else {
          resolve();
        }
      });
    });
    await Promise.all(reloadPromises);
    return true;
  });

  // Handle submit message request (text only, no files)
  ipcMain.handle('submit-message', async (event) => {
    const supersizedPosition = mainWindow.getSupersizedPosition ? mainWindow.getSupersizedPosition() : null;

    // If supersized, only submit to that position
    if (supersizedPosition) {
      const view = mainWindow.viewPositions[supersizedPosition];
      if (view && view.webContents) {
        view.webContents.send('submit-message');
      }
    } else {
      // Submit to all positions
      windowManager.POSITIONS.forEach(pos => {
        const view = mainWindow.viewPositions[pos];
        if (view && view.webContents) {
          view.webContents.send('submit-message');
        }
      });
    }
    return true;
  });

  // Handle submit message with files
  ipcMain.handle('submit-message-with-files', async (event, data) => {
    const { text, files } = data;
    const supersizedPosition = mainWindow.getSupersizedPosition ? mainWindow.getSupersizedPosition() : null;

    const imageFiles = files.filter(f => f.isImage);
    const nonImageFiles = files.filter(f => !f.isImage);

    const targetPositions = supersizedPosition
      ? [supersizedPosition]
      : windowManager.POSITIONS;

    // Save clipboard before modifying it
    const savedClipboard = saveClipboard();

    try {
      for (const pos of targetPositions) {
        const view = mainWindow.viewPositions[pos];
        if (!view || !view.webContents) continue;

        const providerKey = view.providerKey;

        // Step 1: Inject text via existing mechanism
        if (text && text.trim().length > 0) {
          view.webContents.send('text-update', text);
          await delay(200);
        }

        // Step 2: Inject non-image files via executeJavaScript
        for (const file of nonImageFiles) {
          await injectFileViaExecuteJS(view, file, providerKey);
          await delay(200);
        }

        // Step 3: Inject images via clipboard paste (sequential)
        for (const image of imageFiles) {
          await injectImageViaClipboard(view, image.base64, providerKey);
        }

        // Step 4: Wait for upload to complete before submitting
        if (files.length > 0) {
          await waitForUploadComplete(view, providerKey);
        }

        // Step 5: Trigger submit via preload
        view.webContents.send('submit-message');
      }
    } finally {
      // Always restore clipboard
      restoreClipboard(savedClipboard);
    }

    return true;
  });

  // Handle new chat request
  ipcMain.handle('new-chat', async (event) => {
    windowManager.POSITIONS.forEach(pos => {
      const view = mainWindow.viewPositions[pos];
      if (view && view.webContents) {
        view.webContents.send('new-chat');
      }
    });
    return true;
  });

  // Handle zoom in request
  ipcMain.handle('zoom-in', async (event) => {
    const newZoom = Math.min(currentZoomFactor + 0.1, 2.0); // Max 200%
    currentZoomFactor = newZoom;

    windowManager.POSITIONS.forEach(pos => {
      const view = mainWindow.viewPositions[pos];
      if (view && view.webContents) {
        view.webContents.setZoomFactor(newZoom);
      }
    });

    return newZoom;
  });

  // Handle zoom out request
  ipcMain.handle('zoom-out', async (event) => {
    const newZoom = Math.max(currentZoomFactor - 0.1, 0.5); // Min 50%
    currentZoomFactor = newZoom;

    windowManager.POSITIONS.forEach(pos => {
      const view = mainWindow.viewPositions[pos];
      if (view && view.webContents) {
        view.webContents.setZoomFactor(newZoom);
      }
    });

    return newZoom;
  });

  // Handle toggle supersize request
  ipcMain.handle('toggle-supersize', async (event, position) => {
    if (mainWindow.toggleSupersize) {
      const supersizedPosition = mainWindow.toggleSupersize(position);
      return supersizedPosition;
    }
    return null;
  });

  // Handle change provider request
  ipcMain.handle('change-provider', async (event, position, newProvider) => {
    if (mainWindow.changeProvider) {
      return mainWindow.changeProvider(position, newProvider, currentZoomFactor);
    }
    return false;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    mainWindow = await windowManager.createWindow();
  }
});
