import fs from 'fs';

const syncServerPath = 'C:/Project/Gaming Network/Software/Brower/syncServer.js';
let content = fs.readFileSync(syncServerPath, 'utf8');

const badChunk = `    getQrSvg(size = 260) {
        try {
            // Encode complete pairing JSON payload for maximum compatibility
            const payload = JSON.stringify(this.getPairingPayload());
            return generateQrSvg(payload, size);
        } catch (e) {
            console.error('[OcalSyncServer] Error generating QR code:', e);
            return '<svg></svg>';
        }
    } catch (e) {
            console.error('[OcalSyncServer] Error generating QR code:', e);
            return '<svg></svg>';
        }
    }`;

const goodChunk = `    getQrSvg(size = 260) {
        try {
            // Encode complete pairing JSON payload for maximum compatibility
            const payload = JSON.stringify(this.getPairingPayload());
            return generateQrSvg(payload, size);
        } catch (e) {
            console.error('[OcalSyncServer] Error generating QR code:', e);
            return '<svg></svg>';
        }
    }`;

content = content.replace(badChunk, goodChunk);
fs.writeFileSync(syncServerPath, content, 'utf8');
console.log('Fixed getQrSvg duplicated catch in syncServer.js');
