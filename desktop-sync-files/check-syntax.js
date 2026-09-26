import cp from 'child_process';

const files = ['preload.js', 'main.js', 'settings.js', 'syncServer.js', 'qrGenerator.js'];
files.forEach(f => {
    try {
        cp.execSync(`node --check "C:/Project/Gaming Network/Software/Brower/${f}"`, { stdio: 'pipe' });
        console.log(`✓ ${f} syntax OK`);
    } catch (e) {
        console.error(`✗ ${f} syntax error:`, e.stderr ? e.stderr.toString() : e.message);
    }
});
