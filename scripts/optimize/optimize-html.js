#!/usr/bin/env node
/**
 * QScrap HTML Optimization Script
 * Minifies HTML files, removes redundant code
 * 
 * Usage: node scripts/optimize/optimize-html.js
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../public');

/**
 * Scan directory for HTML files
 */
function scanDirectory(dir) {
    const results = [];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                scan(fullPath);
            } else if (stat.isFile() && item.endsWith('.html')) {
                results.push(fullPath);
            }
        }
    }
    
    scan(dir);
    return results;
}

/**
 * Minify HTML
 */
function minifyHTML(html) {
    return html
        // Remove HTML comments (except conditional comments)
        .replace(/<!--(?!\[)(?!.*<!--)([\s\S]*?)-->/g, '')
        // Remove leading/trailing whitespace from tags
        .replace(/>\s+</g, '><')
        // Remove whitespace between tags
        .replace(/>\s{2,}</g, '><')
        // Collapse multiple spaces
        .replace(/\s{2,}/g, ' ')
        // Remove spaces around = in attributes
        .replace(/\s*=\s*/g, '=')
        // Remove optional closing tags (html, head, body, p, li, dt, dd, tr, th, td)
        .replace(/<\/(html|head|body|p|li|dt|dd|tr|th|td)>/gi, '')
        // Remove trailing slash from void elements
        .replace(/\/>/g, '>')
        // Trim the result
        .trim();
}

/**
 * Optimize HTML file
 */
function optimizeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const minified = minifyHTML(content);
        
        const originalSize = fs.statSync(filePath).size;
        
        // Write minified version
        const minPath = filePath.replace('.html', '.min.html');
        fs.writeFileSync(minPath, minified);
        const minSize = fs.statSync(minPath).size;
        
        const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
        
        return {
            original: originalSize,
            minified: minSize,
            savings,
            path: minPath
        };
    } catch (error) {
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Main optimization function
 */
function optimizeHTML() {
    console.log('📄 QScrap HTML Optimization\n');
    
    const htmlFiles = scanDirectory(PUBLIC_DIR);
    
    if (htmlFiles.length === 0) {
        console.log('✅ No HTML files found to optimize');
        return;
    }
    
    console.log(`Found ${htmlFiles.length} HTML files to minify\n`);
    
    let totalOriginal = 0;
    let totalMinified = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (const file of htmlFiles) {
        const relPath = path.relative(PUBLIC_DIR, file);
        const result = optimizeFile(file);
        
        if (result) {
            successCount++;
            totalOriginal += result.original;
            totalMinified += result.minified;
            console.log(`✅ ${relPath}`);
            console.log(`   ${result.original.toLocaleString()} → ${result.minified.toLocaleString()} bytes (${result.savings}% smaller)`);
        } else {
            failCount++;
            console.log(`❌ ${relPath}`);
        }
    }
    
    const totalSavings = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
    
    console.log();
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Processed:  ${successCount + failCount} files`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed:     ${failCount}`);
    console.log();
    console.log(`Original:   ${totalOriginal.toLocaleString()} bytes (${(totalOriginal / 1024).toFixed(1)} KB)`);
    console.log(`Minified:   ${totalMinified.toLocaleString()} bytes (${(totalMinified / 1024).toFixed(1)} KB)`);
    console.log(`Saved:      ${((totalOriginal - totalMinified) / 1024).toFixed(1)} KB (${totalSavings}%)`);
    console.log();
    
    if (failCount > 0) {
        console.log('⚠️  Some files failed to minify. Check errors above.');
        process.exit(1);
    } else {
        console.log('✅ All HTML files optimized successfully!');
    }
}

// Run optimization
optimizeHTML();
