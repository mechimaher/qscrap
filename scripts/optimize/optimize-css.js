#!/usr/bin/env node
/**
 * QScrap CSS Optimization Script
 * Minifies all CSS files with Clean CSS
 * Preserves original files, creates .min.css variants
 * 
 * Usage: node scripts/optimize/optimize-css.js
 */

const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');

const PUBLIC_DIR = path.join(__dirname, '../../public');
const CSS_DIR = path.join(PUBLIC_DIR, 'css');

const cssOptions = {
    level: 2,
    compatibility: '*',
    format: 'keep-breaks'
};

const minifier = new CleanCSS(cssOptions);

/**
 * Scan directory for CSS files
 */
function scanDirectory(dir) {
    const results = [];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.')) {
                scan(fullPath);
            } else if (stat.isFile() && item.endsWith('.css') && !item.endsWith('.min.css')) {
                results.push(fullPath);
            }
        }
    }
    
    scan(dir);
    return results;
}

/**
 * Minify CSS file
 */
function minifyFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Pass the file content as an object with its path to help CleanCSS resolve @imports
        const result = minifier.minify({
            [filePath]: {
                styles: content
            }
        });
        
        if (result.errors && result.errors.length > 0) {
            console.error(`❌ Errors in ${filePath}:`);
            result.errors.forEach(err => console.error(`   ${err}`));
            return false;
        }
        
        const minPath = filePath.replace('.css', '.min.css');
        fs.writeFileSync(minPath, result.styles);
        
        const originalSize = fs.statSync(filePath).size;
        const minSize = fs.statSync(minPath).size;
        const savings = ((1 - minSize / originalSize) * 100).toFixed(1);
        
        return {
            original: originalSize,
            minified: minSize,
            savings
        };
    } catch (error) {
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Main optimization function
 */
function optimizeCSS() {
    console.log('🎨 QScrap CSS Optimization\n');
    
    const cssFiles = scanDirectory(CSS_DIR);
    
    if (cssFiles.length === 0) {
        console.log('✅ No CSS files found to optimize');
        return;
    }
    
    console.log(`Found ${cssFiles.length} CSS files to minify\n`);
    
    let totalOriginal = 0;
    let totalMinified = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (const file of cssFiles) {
        const relPath = path.relative(PUBLIC_DIR, file);
        const result = minifyFile(file);
        
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
        console.log('✅ All CSS files optimized successfully!');
    }
}

// Run optimization
optimizeCSS();
