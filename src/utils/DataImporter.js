// Ocal Browser - Data Importer & Password Manager
// Handles importing Bookmarks (HTML/JSON) and Passwords (CSV/JSON) from Chrome, Firefox, Edge, Safari, Brave, Opera, etc.

export class PasswordManager {
  static STORAGE_KEY = 'ocal-passwords';

  static getPasswords() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  static savePasswords(list) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[PasswordManager] Failed to save passwords', e);
    }
  }

  static addPassword(entry) {
    const list = this.getPasswords();
    const domain = this.extractDomain(entry.url || entry.name || '');
    const newEntry = {
      id: entry.id || `pwd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: entry.name || domain || 'Website Login',
      url: entry.url || '',
      domain: domain || 'login',
      username: entry.username || '',
      password: entry.password || '',
      notes: entry.notes || '',
      created: entry.created || Date.now(),
      updated: Date.now()
    };

    // Replace if duplicate domain & username exist, otherwise prepend
    const existingIdx = list.findIndex(
      p => p.domain.toLowerCase() === newEntry.domain.toLowerCase() &&
           p.username.toLowerCase() === newEntry.username.toLowerCase()
    );

    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...newEntry };
    } else {
      list.unshift(newEntry);
    }

    this.savePasswords(list);
    return newEntry;
  }

  static deletePassword(id) {
    const list = this.getPasswords().filter(p => String(p.id) !== String(id));
    this.savePasswords(list);
    return list;
  }

  static clearAll() {
    this.savePasswords([]);
  }

  static extractDomain(raw) {
    if (!raw) return '';
    try {
      let u = raw;
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        u = 'https://' + u;
      }
      return new URL(u).hostname.replace(/^(www\.|m\.)/i, '');
    } catch {
      return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    }
  }
}

export class DataImporter {
  // =========================================================================
  // 1. BOOKMARKS IMPORT & EXPORT
  // =========================================================================

  /**
   * Imports bookmarks from Netscape Bookmark Format HTML string
   * Used by Chrome, Firefox, Edge, Safari, Brave, Opera, etc.
   */
  static parseBookmarksHtml(htmlString) {
    const importedBookmarks = [];
    if (!htmlString || typeof htmlString !== 'string') return importedBookmarks;

    // Use DOMParser if available, fallback to regex
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const anchors = doc.querySelectorAll('a[href]');

        anchors.forEach(a => {
          const href = a.getAttribute('href')?.trim();
          const title = a.textContent?.trim() || href;
          const addDate = a.getAttribute('add_date');

          if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            importedBookmarks.push({
              url: href,
              title: title || href,
              time: addDate ? parseInt(addDate, 10) * 1000 : Date.now()
            });
          }
        });
      } catch (err) {
        console.warn('[DataImporter] DOMParser failed, falling back to regex', err);
      }
    }

    // Fallback or secondary regex scanner if DOMParser got 0 items
    if (importedBookmarks.length === 0) {
      const regex = /<A\s+[^>]*HREF=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/A>/gi;
      let match;
      while ((match = regex.exec(htmlString)) !== null) {
        const href = match[1].trim();
        const rawTitle = match[2].replace(/<[^>]+>/g, '').trim();
        importedBookmarks.push({
          url: href,
          title: rawTitle || href,
          time: Date.now()
        });
      }
    }

    return this.mergeBookmarks(importedBookmarks);
  }

  /**
   * Imports bookmarks from JSON array [{ url, title }]
   */
  static parseBookmarksJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const list = Array.isArray(parsed) ? parsed : (parsed.bookmarks || []);
      const valid = list.filter(b => b && b.url && (b.url.startsWith('http://') || b.url.startsWith('https://'))).map(b => ({
        url: b.url.trim(),
        title: b.title?.trim() || b.url.trim(),
        time: b.time || Date.now()
      }));
      return this.mergeBookmarks(valid);
    } catch (e) {
      throw new Error('Invalid JSON bookmarks format');
    }
  }

  /**
   * Merges imported bookmarks into localStorage['ocal-bookmarks']
   * Avoids duplicates based on URL
   */
  static mergeBookmarks(newItems) {
    let current = [];
    try {
      current = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    } catch {
      current = [];
    }

    const seenUrls = new Set(current.map(b => b.url.toLowerCase()));
    let addedCount = 0;

    for (const item of newItems) {
      const normalizedUrl = item.url.toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        current.unshift({
          url: item.url,
          title: item.title || item.url,
          time: item.time || Date.now()
        });
        addedCount++;
      }
    }

    localStorage.setItem('ocal-bookmarks', JSON.stringify(current));
    return { total: current.length, added: addedCount };
  }

  /**
   * Exports bookmarks in standard Netscape Bookmark HTML format
   */
  static exportBookmarksHtml() {
    let current = [];
    try {
      current = JSON.parse(localStorage.getItem('ocal-bookmarks') || '[]');
    } catch {
      current = [];
    }

    const lines = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<!-- This is an automatically generated file.',
      '     It will be read and overwritten.',
      '     DO NOT EDIT! -->',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
      '    <DT><H3 ADD_DATE="' + Math.floor(Date.now() / 1000) + '">Ocal Browser Bookmarks</H3>',
      '    <DL><p>'
    ];

    for (const bm of current) {
      const safeUrl = bm.url.replace(/"/g, '&quot;');
      const safeTitle = (bm.title || bm.url).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const addDate = Math.floor((bm.time || Date.now()) / 1000);
      lines.push(`        <DT><A HREF="${safeUrl}" ADD_DATE="${addDate}">${safeTitle}</A>`);
    }

    lines.push('    </DL><p>');
    lines.push('</DL><p>');

    const htmlContent = lines.join('\n');
    this.downloadFile(htmlContent, 'ocal_bookmarks_backup.html', 'text/html');
    return current.length;
  }

  // =========================================================================
  // 2. PASSWORDS IMPORT & EXPORT
  // =========================================================================

  /**
   * Robust CSV parser complying with RFC 4180 (handles commas inside quotes, escapes)
   */
  static parseCsvRows(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;
    const len = csvText.length;

    while (i < len) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      }

      if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \r in CRLF
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(f => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }

      currentField += char;
      i++;
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Imports passwords from CSV format exported by Chrome, Firefox, Safari, Edge, Brave, Bitwarden, etc.
   */
  static parsePasswordsCsv(csvString) {
    const rows = this.parseCsvRows(csvString);
    if (!rows || rows.length < 2) {
      throw new Error('CSV file is empty or missing headers.');
    }

    // Inspect headers
    const headerRow = rows[0].map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
    
    // Column index detectors
    const urlIdx = headerRow.findIndex(h => h === 'url' || h === 'website' || h === 'site' || h === 'loginuri' || h === 'domain');
    const userIdx = headerRow.findIndex(h => h === 'username' || h === 'user' || h === 'login' || h === 'email' || h === 'loginusername' || h === 'usernameoremail');
    const pwdIdx = headerRow.findIndex(h => h === 'password' || h === 'pass' || h === 'loginpassword' || h === 'secret');
    const nameIdx = headerRow.findIndex(h => h === 'name' || h === 'title' || h === 'servicename');
    const notesIdx = headerRow.findIndex(h => h === 'notes' || h === 'note' || h === 'comment');

    if (pwdIdx === -1) {
      throw new Error('Could not identify a "Password" column in the uploaded CSV file.');
    }

    let addedCount = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const password = row[pwdIdx] || '';
      if (!password) continue; // Skip empty passwords

      const rawUrl = urlIdx !== -1 ? row[urlIdx] : '';
      const username = userIdx !== -1 ? row[userIdx] : '';
      const name = nameIdx !== -1 ? row[nameIdx] : '';
      const notes = notesIdx !== -1 ? row[notesIdx] : '';

      const domain = PasswordManager.extractDomain(rawUrl || name);

      // Add to vault
      PasswordManager.addPassword({
        name: name || domain || 'Website Login',
        url: rawUrl,
        username,
        password,
        notes
      });
      addedCount++;
    }

    return { total: PasswordManager.getPasswords().length, added: addedCount };
  }

  /**
   * Imports passwords from JSON
   */
  static parsePasswordsJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const list = Array.isArray(parsed) ? parsed : (parsed.passwords || parsed.logins || []);
      let added = 0;

      for (const item of list) {
        if (item && item.password) {
          PasswordManager.addPassword(item);
          added++;
        }
      }

      return { total: PasswordManager.getPasswords().length, added };
    } catch {
      throw new Error('Invalid JSON passwords format');
    }
  }

  /**
   * Exports passwords in standard CSV format
   */
  static exportPasswordsCsv() {
    const list = PasswordManager.getPasswords();
    const rows = [
      ['name', 'url', 'username', 'password', 'note']
    ];

    for (const p of list) {
      rows.push([
        p.name || p.domain || '',
        p.url || '',
        p.username || '',
        p.password || '',
        p.notes || ''
      ]);
    }

    const csvContent = rows.map(r => r.map(field => {
      const str = String(field || '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')).join('\r\n');

    this.downloadFile(csvContent, 'ocal_passwords_export.csv', 'text/csv');
    return list.length;
  }

  /**
   * Client-side file downloader helper
   */
  static downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
