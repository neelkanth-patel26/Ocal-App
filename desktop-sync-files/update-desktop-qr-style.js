import fs from 'fs';

const htmlPath = 'C:/Project/Gaming Network/Software/Brower/settings.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// Update #sync-qr-container style to be strictly square and sharp
const oldQrBox = /<div id="sync-qr-container"[^>]*>/;
const newQrBox = `<div id="sync-qr-container" style="background: #ffffff; padding: 12px; border-radius: 4px; box-shadow: 0 8px 28px rgba(0,0,0,0.25); border: 2px solid var(--accent); width: 240px; height: 240px; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 0 auto;">`;

if (oldQrBox.test(html)) {
    html = html.replace(oldQrBox, newQrBox);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('✓ Updated #sync-qr-container to strictly square style in settings.html');
}

// Check settings.js
const jsPath = 'C:/Project/Gaming Network/Software/Brower/settings.js';
let js = fs.readFileSync(jsPath, 'utf8');

const oldSvgStyle = `        const svgEl = qrContainer.querySelector('svg');
        if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
        }`;
const newSvgStyle = `        const svgEl = qrContainer.querySelector('svg');
        if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = '100%';
            svgEl.style.display = 'block';
            svgEl.style.aspectRatio = '1 / 1';
        }`;

if (js.includes(oldSvgStyle)) {
    js = js.replace(oldSvgStyle, newSvgStyle);
    fs.writeFileSync(jsPath, js, 'utf8');
    console.log('✓ Updated SVG sizing in settings.js');
}
