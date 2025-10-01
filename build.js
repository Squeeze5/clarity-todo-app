const fs = require('fs');
const path = require('path');

// Create lib directory if it doesn't exist
const libDir = path.join(__dirname, 'lib');
if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
}

// Copy InstantDB file
const sourcePath = path.join(__dirname, 'node_modules', '@instantdb', 'core', 'dist', 'standalone', 'index.umd.cjs');
const targetPath = path.join(__dirname, 'lib', 'instantdb.js');

try {
    fs.copyFileSync(sourcePath, targetPath);
    console.log('✅ InstantDB library copied to lib/instantdb.js');
} catch (error) {
    console.error('❌ Error copying InstantDB library:', error.message);
    process.exit(1);
}