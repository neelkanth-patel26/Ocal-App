/**
 * Ocal Browser - High-Precision QR Code Generator (SVG Output)
 * Uses standard qrcode library for 100% ISO/IEC 18004 compliance.
 */
const QRCode = require('qrcode');

function generateQrSvg(text, size = 220) {
    try {
        const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
        const count = qr.modules.size;
        const margin = 2;
        const totalSize = count + (margin * 2);
        const cellSize = size / totalSize;

        let rects = '';
        for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
                if (qr.modules.get(r, c)) {
                    const x = ((c + margin) * cellSize).toFixed(2);
                    const y = ((r + margin) * cellSize).toFixed(2);
                    const s = (cellSize + 0.05).toFixed(2);
                    rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#000000" />`;
                }
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="background:#ffffff; border-radius:12px; padding:10px; box-sizing:border-box; display:block;">
  <rect width="100%" height="100%" fill="#ffffff" rx="12" />
  ${rects}
</svg>`;
    } catch (e) {
        console.error('[generateQrSvg] Error generating QR code:', e);
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><text x="50%" y="50%" text-anchor="middle" fill="#888">QR Error</text></svg>`;
    }
}

module.exports = { generateQrSvg };
