'use strict';

const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const config = require('./config');

/**
 * Preview Modal Manager (Main Process)
 * Shows before/after diff before paste, waits for user approval
 */
class PreviewModal {
  constructor() {
    this.previewWindow = null;
    this.pendingResolve = null;
  }

  /**
   * Show preview modal and wait for user choice
   * @param {object} configData
   * @returns {Promise<"approve" | "reject" | "original">}
   */
  async showPreview(configData) {
    return new Promise(async (resolve) => {
      this.pendingResolve = resolve;

      if (this.previewWindow) {
        this.previewWindow.close();
      }

      // Get mouse position to spawn near cursor
      const point = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(point);
      
      const width = 900;
      const height = 550;
      let x = point.x - width / 2;
      let y = point.y - height / 2;
      
      // Keep on screen
      if (x < display.bounds.x) x = display.bounds.x;
      if (y < display.bounds.y) y = display.bounds.y;
      if (x + width > display.bounds.x + display.bounds.width) x = display.bounds.x + display.bounds.width - width;
      if (y + height > display.bounds.y + display.bounds.height) y = display.bounds.y + display.bounds.height - height;

      this.previewWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        show: false,
        webPreferences: {
          preload: path.join(__dirname, '../renderer/preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      this.previewWindow.loadFile(path.join(__dirname, '../renderer/preview-modal.html'));

      this.previewWindow.once('ready-to-show', () => {
        this.previewWindow.showInactive(); 
        this.previewWindow.webContents.send('preview-data', configData);
      });

      const handleDecision = async (event, decision) => {
        if (!this.previewWindow) return;
        
        const currentResolve = this.pendingResolve;
        this.pendingResolve = null; // Clear it so 'closed' event doesn't auto-reject

        this.previewWindow.close();
        this.previewWindow = null;
        ipcMain.removeListener('preview-decision', handleDecision);
        
        // Wait for OS focus to physically shift back
        await new Promise(r => setTimeout(r, 150));
        
        if (currentResolve) {
          currentResolve(decision);
        } else {
          resolve(decision);
        }
      };

      ipcMain.on('preview-decision', handleDecision);

      this.previewWindow.on('closed', () => {
        this.previewWindow = null;
        ipcMain.removeListener('preview-decision', handleDecision);
        if (this.pendingResolve) {
            this.pendingResolve("reject"); // Default to reject on close
            this.pendingResolve = null;
        }
      });
    });
  }
}

module.exports = new PreviewModal();
