#!/usr/bin/env node
/**
 * QScrap JavaScript Optimization Script
 * Minifies all JS files with terser
 * Preserves original files, creates .min.js variants
 * 
 * Usage: node scripts/optimize/optimize-js.js
 */

const fs = require('fs');
const path = require('path');

// Check if terser is available, otherwise use simple minification
let terser;
try {
    terser = require('terser');
} catch {
    console.log('⚠️  Terser not installed. Install with: npm install -D terser');
    terser = null;
}

const PUBLIC_DIR = path.join(__dirname, '../../public');
const JS_DIR = path.join(PUBLIC_DIR, 'js');

/**
 * Scan directory for JS files
 */
function scanDirectory(dir, excludeDirs = ['node_modules', 'vendor']) {
    const results = [];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && !excludeDirs.includes(item)) {
                scan(fullPath);
            } else if (stat.isFile() && item.endsWith('.js') && !item.endsWith('.min.js')) {
                results.push(fullPath);
            }
        }
    }
    
    scan(dir);
    return results;
}

/**
 * Simple minification (fallback if terser not available)
 */
function simpleMinify(code) {
    return code
        // Remove single-line comments (but not in strings)
        .replace(/([^:]|^)\/\/.*$/gm, '$1')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove leading/trailing whitespace from lines
        .replace(/^\s+|\s+$/gm, '')
        // Collapse multiple newlines
        .replace(/\n\s*\n/g, '\n')
        // Remove spaces around operators (simple cases)
        .replace(/\s*([=+\-*/<>!&|?:])\s*/g, '$1');
}

/**
 * Minify JS file
 */
async function minifyFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let minified;
        
        if (terser) {
            const result = await terser.minify(content, {
                compress: {
                    drop_console: false,
                    pure_funcs: ['console.log']
                },
                mangle: {
                    reserved: ['exports', 'module', 'require', 'window', 'document']
                },
                format: {
                    comments: false
                }
            });
            
            if (result.error) {
                throw result.error;
            }
            
            minified = result.code;
        } else {
            minified = simpleMinify(content);
        }
        
        const minPath = filePath.replace('.js', '.min.js');
        fs.writeFileSync(minPath, minified);
        
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
async function optimizeJS() {
    console.log('⚡ QScrap JavaScript Optimization\n');
    
    const jsFiles = scanDirectory(JS_DIR);
    
    if (jsFiles.length === 0) {
        console.log('✅ No JavaScript files found to optimize');
        return;
    }
    
    console.log(`Found ${jsFiles.length} JavaScript files to minify\n`);
    console.log(`Using: ${terser ? 'Terser (advanced)' : 'Simple minification (basic)'}\n`);
    
    let totalOriginal = 0;
    let totalMinified = 0;
    let successCount = 0;
    let failCount = 0;
    
    for (const file of jsFiles) {
        const relPath = path.relative(PUBLIC_DIR, file);
        const result = await minifyFile(file);
        
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
    
    if (!terser) {
        console.log('💡 Tip: Install terser for better minification:');
        console.log('   npm install -D terser\n');
    }
    
    if (failCount > 0) {
        console.log('⚠️  Some files failed to minify. Check errors above.');
        process.exit(1);
    } else {
        console.log('✅ All JavaScript files optimized successfully!');
    }
}

// Run optimization
optimizeJS().catch(console.error);
