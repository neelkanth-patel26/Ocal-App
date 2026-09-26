// Ocal Browser Downloads Manager
export class DownloadsManager {
  constructor() {
    this.listeners = new Set();
    this.initNativeListener();
  }

  static getDownloads() {
    try {
      return JSON.parse(localStorage.getItem('ocal-downloads') || '[]');
    } catch {
      return [];
    }
  }

  static saveDownloads(list) {
    try {
      localStorage.setItem('ocal-downloads', JSON.stringify(list));
    } catch (e) {
      console.warn('[DownloadsManager] Failed to save downloads', e);
    }
  }

  static addDownload(item) {
    const list = this.getDownloads();
    const id = item.id || `dl_${Date.now()}`;
    const newItem = {
      id,
      filename: item.filename || 'download',
      url: item.url || '',
      filePath: item.filePath || ('Download/' + (item.filename || 'download')),
      fileSize: item.fileSize || 0,
      totalBytes: item.totalBytes || 0,
      downloadedBytes: item.downloadedBytes || 0,
      progress: item.progress || 0,
      status: item.status || 'downloading', // 'downloading' | 'completed' | 'failed'
      mimetype: item.mimetype || '',
      timestamp: item.timestamp || Date.now()
    };
    list.unshift(newItem);
    this.saveDownloads(list);
    this.notifyChange(newItem, 'added');
    return newItem;
  }

  static updateDownload(id, updates) {
    const list = this.getDownloads();
    const idx = list.findIndex(d => String(d.id) === String(id));
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      this.saveDownloads(list);
      this.notifyChange(list[idx], 'updated');
      return list[idx];
    }
    return null;
  }

  static removeDownload(id) {
    const list = this.getDownloads().filter(d => String(d.id) !== String(id));
    this.saveDownloads(list);
    this.notifyChange({ id }, 'removed');
  }

  static clearCompleted() {
    const list = this.getDownloads().filter(d => d.status === 'downloading');
    this.saveDownloads(list);
    this.notifyChange(null, 'cleared');
  }

  static addListener(fn) {
    if (!window.__ocalDlListeners) window.__ocalDlListeners = new Set();
    window.__ocalDlListeners.add(fn);
    return () => window.__ocalDlListeners.delete(fn);
  }

  static notifyChange(item, type) {
    if (window.__ocalDlListeners) {
      window.__ocalDlListeners.forEach(fn => {
        try { fn(item, type); } catch {}
      });
    }
  }

  initNativeListener() {
    // Listen for Native Android Bridge events
    window.onNativeDownloadEvent = (event) => {
      if (!event || !event.type) return;

      if (event.type === 'DOWNLOAD_STARTED') {
        DownloadsManager.addDownload({
          id: event.downloadId,
          filename: event.filename,
          url: event.url,
          filePath: event.filePath,
          totalBytes: event.contentLength || 0,
          downloadedBytes: 0,
          progress: 0,
          status: 'downloading',
          mimetype: event.mimetype,
          timestamp: Date.now()
        });
        if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
          window.ocalApp.showToast(`Downloading ${event.filename}`, 'download');
        }
      } else if (event.type === 'DOWNLOAD_PROGRESS') {
        const total = event.totalBytes || 1;
        const current = event.downloadedBytes || 0;
        const progress = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
        DownloadsManager.updateDownload(event.downloadId, {
          downloadedBytes: current,
          totalBytes: total,
          progress,
          status: 'downloading'
        });
      } else if (event.type === 'DOWNLOAD_FINISHED') {
        DownloadsManager.updateDownload(event.downloadId, {
          status: event.success ? 'completed' : 'failed',
          progress: 100,
          totalBytes: event.totalBytes || 0,
          filePath: event.filePath
        });
        if (window.ocalApp && typeof window.ocalApp.showToast === 'function') {
          window.ocalApp.showToast(event.success ? `Downloaded ${event.filename}` : `Download failed: ${event.filename}`, event.success ? 'check' : 'alert');
        }
      }
    };
  }

  static formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  static getFileIconClass(filename, mimetype) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (ext === 'pdf' || mimetype?.includes('pdf')) return { icon: 'fas fa-file-pdf', type: 'pdf' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimetype?.startsWith('image/')) return { icon: 'fas fa-file-image', type: 'image' };
    if (['mp4', 'mkv', 'webm', 'avi', 'mov'].includes(ext) || mimetype?.startsWith('video/')) return { icon: 'fas fa-file-video', type: 'video' };
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext) || mimetype?.startsWith('audio/')) return { icon: 'fas fa-file-audio', type: 'audio' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimetype?.includes('zip') || mimetype?.includes('compressed')) return { icon: 'fas fa-file-zipper', type: 'archive' };
    if (['apk', 'aab'].includes(ext) || mimetype?.includes('android.package-archive')) return { icon: 'fas fa-cube', type: 'apk' };
    if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return { icon: 'fas fa-file-lines', type: 'doc' };
    return { icon: 'fas fa-file', type: 'generic' };
  }
}
