const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '../public/css');
const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.endsWith('.min.css'));

files.forEach(file => {
    const filePath = path.join(cssDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Simple minification regex
    const minified = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ')             // Collapse whitespace
        .replace(/\s*([{}:;,])\s*/g, '$1') // Remove spaces around delimiters
        .trim();

    const minPath = path.join(cssDir, file.replace('.css', '.min.css'));
    fs.writeFileSync(minPath, minified);
    console.log(`Minified: ${file} -> ${path.basename(minPath)}`);
});
