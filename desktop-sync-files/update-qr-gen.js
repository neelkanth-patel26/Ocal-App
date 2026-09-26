import fs from 'fs';
import path from 'path';

const qrGenPath = 'C:/Project/Gaming Network/Software/Brower/qrGenerator.js';
let content = fs.readFileSync(qrGenPath, 'utf8');

// Replace generateQrSvg function
const newGenerateQrSvg = `function generateQrSvg(text, size = 260) {
    if (!text) return '<svg></svg>';
    const qr = new QRCodeModel(0, QRErrorCorrectLevel.M);
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    // ISO standard 4-module quiet zone ensures reliable detection by all phone cameras
    const margin = 4;
    const totalCount = count + (margin * 2);

    let rects = "";
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
                rects += \`<rect x="\${c + margin}" y="\${r + margin}" width="1" height="1" fill="#000000" />\`;
            }
        }
    }

    return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \${totalCount} \${totalCount}" width="100%" height="100%" shape-rendering="crispEdges" style="display:block;aspect-ratio:1/1;max-width:100%;max-height:100%;"><rect width="\${totalCount}" height="\${totalCount}" fill="#ffffff" />\${rects}</svg>\`;
}`;

const oldFuncRegex = /function generateQrSvg\([\s\S]*?return `<svg[\s\S]*?<\/svg>`;\s*\}/;
if (oldFuncRegex.test(content)) {
    content = content.replace(oldFuncRegex, newGenerateQrSvg);
    fs.writeFileSync(qrGenPath, content, 'utf8');
    console.log('✓ Successfully updated generateQrSvg in Brower/qrGenerator.js');
} else {
    console.error('✗ Could not match old generateQrSvg in Brower/qrGenerator.js');
}
