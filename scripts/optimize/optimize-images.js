#!/usr/bin/env node
/**
 * QScrap Image Optimization Script
 * Converts images to WebP format with fallbacks
 * Uses sharp for image processing
 * 
 * Usage: node scripts/optimize/optimize-images.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
    sharp = require('sharp');
} catch {
    console.log('⚠️  Sharp not installed. Install with: npm install -D sharp');
    sharp = null;
}

const PUBLIC_DIR = path.join(__dirname, '../../public');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];

/**
 * Scan directory for image files
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
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                if (IMAGE_EXTENSIONS.includes(ext)) {
                    results.push(fullPath);
                }
            }
        }
    }
    
    scan(dir);
    return results;
}

/**
 * Convert image to WebP
 */
async function convertToWebP(filePath, quality = 80) {
    if (!sharp) {
        return false;
    }
    
    try {
        const webpPath = filePath.replace(path.extname(filePath), '.webp');
        
        await sharp(filePath)
            .webp({ quality })
            .toFile(webpPath);
        
        const originalSize = fs.statSync(filePath).size;
        const webpSize = fs.statSync(webpPath).size;
        const savings = ((1 - webpSize / originalSize) * 100).toFixed(1);
        
        return {
            original: originalSize,
            webp: webpSize,
            savings,
            path: webpPath
        };
    } catch (error) {
        console.error(`   Error: ${error.message}`);
        return false;
    }
}

/**
 * Optimize PNG/JPG in place
 */
async function optimizeInPlace(filePath) {
    if (!sharp) {
        return false;
    }
    
    try {
        const ext = path.extname(filePath).toLowerCase();
        const metadata = await sharp(filePath).metadata();
        
        let optimized = false;
        let newSize = 0;
        
        if (ext === '.png') {
            // Optimize PNG
            const tempPath = filePath + '.tmp.png';
            await sharp(filePath)
                .png({ compressionLevel: 9, palette: true })
                .toFile(tempPath);
            
            newSize = fs.statSync(tempPath).size;
            if (newSize < fs.statSync(filePath).size) {
                fs.renameSync(tempPath, filePath);
                optimized = true;
            } else {
                fs.unlinkSync(tempPath);
            }
        } else if (ext === '.jpg' || ext === '.jpeg') {
            // Optimize JPEG
            const tempPath = filePath + '.tmp.jpg';
            await sharp(filePath)
                .jpeg({ quality: 85, mozjpeg: true })
                .toFile(tempPath);
            
            newSize = fs.statSync(tempPath).size;
            if (newSize < fs.statSync(filePath).size) {
                fs.renameSync(tempPath, filePath);
                optimized = true;
            } else {
                fs.unlinkSync(tempPath);
            }
        }
        
        return {
            original: fs.statSync(filePath).size,
            optimized,
            path: filePath
        };
    } catch (error) {
        console.error(`   Error: ${error.message}`);
        return false;
    }
}

/**
 * Main optimization function
 */
async function optimizeImages() {
    console.log('🖼️  QScrap Image Optimization\n');
    
    if (!sharp) {
        console.log('❌ Sharp library not available. Install with:');
        console.log('   npm install -D sharp\n');
        process.exit(1);
    }
    
    const imageFiles = scanDirectory(PUBLIC_DIR);
    
    if (imageFiles.length === 0) {
        console.log('✅ No image files found to optimize');
        return;
    }
    
    console.log(`Found ${imageFiles.length} images to process\n`);
    
    let webpCount = 0;
    let webpSavings = 0;
    let skipCount = 0;
    
    for (const file of imageFiles) {
        const relPath = path.relative(PUBLIC_DIR, file);
        const webpPath = file.replace(path.extname(file), '.webp');
        
        // Skip if WebP already exists and is newer
        if (fs.existsSync(webpPath)) {
            const origStat = fs.statSync(file);
            const webpStat = fs.statSync(webpPath);
            
            if (webpStat.mtime > origStat.mtime) {
                skipCount++;
                console.log(`⏭️  ${relPath} (WebP exists)`);
                continue;
            }
        }
        
        console.log(`🔄 ${relPath}`);
        
        const result = await convertToWebP(file);
        
        if (result) {
            webpCount++;
            webpSavings += parseFloat(result.savings);
            console.log(`   ✅ Created: ${path.relative(PUBLIC_DIR, result.path)}`);
            console.log(`   ${result.original.toLocaleString()} → ${result.webp.toLocaleString()} bytes (${result.savings}% smaller)`);
        } else {
            console.log(`   ❌ Failed to convert`);
        }
    }
    
    const avgSavings = webpCount > 0 ? (webpSavings / webpCount).toFixed(1) : 0;
    
    console.log();
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Images:    ${imageFiles.length}`);
    console.log(`WebP Created:    ${webpCount}`);
    console.log(`Skipped:         ${skipCount}`);
    console.log(`Average Savings: ${avgSavings}%`);
    console.log();
    
    // Generate HTML helper for using WebP with fallbacks
    console.log('💡 USAGE IN HTML:');
    console.log('─'.repeat(60));
    console.log(`<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description" loading="lazy">
</picture>`);
    console.log();
    console.log('✅ Image optimization complete!');
}

// Run optimization
optimizeImages().catch(console.error);
