import fs from 'fs';

const syncServerPath = 'C:/Project/Gaming Network/Software/Brower/syncServer.js';
let content = fs.readFileSync(syncServerPath, 'utf8');

// 1. Update constructor callback normalization
const constructorSearch = 'this.callbacks = Object.assign({';
const constructorNormalize = `this.callbacks = Object.assign({
            getBookmarks: () => [],
            setBookmarks: () => {},
            getHistory: () => [],
            setHistory: () => {},
            getPasswords: () => [],
            setPasswords: () => {},
            onReceiveTab: () => {},
            onReceiveClipboard: () => {},
            getClipboardText: () => '',
            setClipboardText: () => {},
            onDevicePaired: () => {},
            onDeviceUnpaired: () => {}
        }, callbacks);

        // Normalize bridge between both naming conventions
        if (callbacks.onOpenTab && !callbacks.onReceiveTab) {
            this.callbacks.onReceiveTab = callbacks.onOpenTab;
        }
        if (callbacks.onClipboardReceived && !callbacks.onReceiveClipboard) {
            this.callbacks.onReceiveClipboard = callbacks.onClipboardReceived;
        }
        if (callbacks.onBookmarksReceived && !callbacks.setBookmarks) {
            this.callbacks.setBookmarks = callbacks.onBookmarksReceived;
        }
        if (callbacks.onPasswordsReceived && !callbacks.setPasswords) {
            this.callbacks.setPasswords = callbacks.onPasswordsReceived;
        }
        if (callbacks.onHistoryReceived && !callbacks.setHistory) {
            this.callbacks.setHistory = callbacks.onHistoryReceived;
        }
        if (callbacks.onPairingSuccess && !callbacks.onDevicePaired) {
            this.callbacks.onDevicePaired = callbacks.onPairingSuccess;
        }
        if (callbacks.onUnpaired && !callbacks.onDeviceUnpaired) {
            this.callbacks.onDeviceUnpaired = callbacks.onUnpaired;
        }`;

// Replace constructor block
const constructorBlockRegex = /this\.callbacks\s*=\s*Object\.assign\(\{[\s\S]*?\}, callbacks\);/;
if (constructorBlockRegex.test(content)) {
    content = content.replace(constructorBlockRegex, constructorNormalize);
    console.log('✓ Constructor callback bridge added');
}

// 2. Update getQrSvg to encode JSON payload
const getQrSvgRegex = /getQrSvg\(size\s*=\s*\d+\)\s*\{[\s\S]*?return generateQrSvg\(uri,\s*size\);[\s\S]*?\}/;
const newGetQrSvg = `getQrSvg(size = 260) {
        try {
            // Encode complete pairing JSON payload for maximum compatibility
            const payload = JSON.stringify(this.getPairingPayload());
            return generateQrSvg(payload, size);
        } catch (e) {
            console.error('[OcalSyncServer] Error generating QR code:', e);
            return '<svg></svg>';
        }
    }`;
if (getQrSvgRegex.test(content)) {
    content = content.replace(getQrSvgRegex, newGetQrSvg);
    console.log('✓ getQrSvg updated to encode JSON payload');
}

// 3. Update _sendJson to always include CORS headers
const sendJsonRegex = /_sendJson\(res,\s*statusCode,\s*data\)\s*\{[\s\S]*?res\.end\(JSON\.stringify\(data\)\);\s*\}/;
const newSendJson = `_sendJson(res, statusCode, data) {
        res.writeHead(statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ocal-Token'
        });
        res.end(JSON.stringify(data));
    }`;
if (sendJsonRegex.test(content)) {
    content = content.replace(sendJsonRegex, newSendJson);
    console.log('✓ _sendJson updated with universal CORS headers');
}

// 4. Update OPTIONS handler
const optionsRegex = /if\s*\(req\.method === 'OPTIONS'\)\s*\{[\s\S]*?return res\.end\(\);\s*\}/;
const newOptions = `if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ocal-Token',
                'Content-Length': '0'
            });
            return res.end();
        }`;
if (optionsRegex.test(content)) {
    content = content.replace(optionsRegex, newOptions);
    console.log('✓ OPTIONS handler updated with explicit CORS 204 response');
}

fs.writeFileSync(syncServerPath, content, 'utf8');
console.log('✓ syncServer.js updated successfully');
