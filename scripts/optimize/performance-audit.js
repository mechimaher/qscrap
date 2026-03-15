#!/usr/bin/env node
/**
 * QScrap Performance Audit Script
 * Analyzes public assets and generates optimization report
 * 
 * Usage: node scripts/optimize/performance-audit.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC_DIR = path.join(__dirname, '../../public');
const REPORT_DIR = path.join(__dirname, '../../audit-output');

// Ensure report directory exists
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

/**
 * Get gzipped size
 */
function getGzippedSize(filePath) {
    try {
        const content = fs.readFileSync(filePath);
        return zlib.gzipSync(content).length;
    } catch {
        return 0;
    }
}

/**
 * Scan directory for files
 */
function scanDirectory(dir, extensions) {
    const results = [];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                scan(fullPath);
            } else if (stat.isFile() && extensions.includes(path.extname(item))) {
                results.push(fullPath);
            }
        }
    }
    
    scan(dir);
    return results;
}

/**
 * Analyze CSS files
 */
function analyzeCSS(files) {
    const results = [];
    let totalSize = 0;
    let totalGzipped = 0;
    
    for (const file of files) {
        const size = getFileSize(file);
        const gzipped = getGzippedSize(file);
        const relPath = path.relative(PUBLIC_DIR, file);
        const isMinified = file.includes('.min.');
        
        totalSize += size;
        totalGzipped += gzipped;
        
        results.push({
            file: relPath,
            size,
            gzipped,
            minified: isMinified,
            ratio: ((gzipped / size) * 100).toFixed(1)
        });
    }
    
    return {
        files: results,
        totalSize,
        totalGzipped,
        count: files.length,
        minifiedCount: results.filter(f => f.minified).length
    };
}

/**
 * Analyze JavaScript files
 */
function analyzeJS(files) {
    const results = [];
    let totalSize = 0;
    let totalGzipped = 0;
    
    for (const file of files) {
        const size = getFileSize(file);
        const gzipped = getGzippedSize(file);
        const relPath = path.relative(PUBLIC_DIR, file);
        const isMinified = file.includes('.min.');
        
        totalSize += size;
        totalGzipped += gzipped;
        
        results.push({
            file: relPath,
            size,
            gzipped,
            minified: isMinified,
            ratio: ((gzipped / size) * 100).toFixed(1)
        });
    }
    
    return {
        files: results,
        totalSize,
        totalGzipped,
        count: files.length,
        minifiedCount: results.filter(f => f.minified).length
    };
}

/**
 * Analyze Image files
 */
function analyzeImages(files) {
    const results = [];
    let totalSize = 0;
    const byType = {};
    
    for (const file of files) {
        const size = getFileSize(file);
        const relPath = path.relative(PUBLIC_DIR, file);
        const ext = path.extname(file).toLowerCase();
        
        totalSize += size;
        
        if (!byType[ext]) {
            byType[ext] = { count: 0, size: 0 };
        }
        byType[ext].count++;
        byType[ext].size += size;
        
        results.push({
            file: relPath,
            size,
            type: ext,
            webpAvailable: fs.existsSync(file.replace(ext, '.webp'))
        });
    }
    
    return {
        files: results,
        totalSize,
        count: files.length,
        byType,
        webpCoverage: results.filter(f => f.webpAvailable).length / files.length * 100
    };
}

/**
 * Analyze HTML files
 */
function analyzeHTML(files) {
    const results = [];
    let totalSize = 0;
    
    for (const file of files) {
        const size = getFileSize(file);
        const gzipped = getGzippedSize(file);
        const relPath = path.relative(PUBLIC_DIR, file);
        const content = fs.readFileSync(file, 'utf8');
        
        totalSize += size;
        
        // Check for common issues
        const issues = [];
        
        if (!content.includes('viewport')) {
            issues.push('Missing viewport meta tag');
        }
        if (!content.includes('description')) {
            issues.push('Missing meta description');
        }
        if ((content.match(/<script[^>]*src/g) || []).length > 5) {
            issues.push('Many script tags - consider bundling');
        }
        if ((content.match(/<link[^>]*stylesheet/g) || []).length > 5) {
            issues.push('Many CSS files - consider bundling');
        }
        if (!content.includes('defer') && !content.includes('async')) {
            const scriptCount = (content.match(/<script[^>]*src/g) || []).length;
            if (scriptCount > 0) {
                issues.push('Scripts without defer/async attributes');
            }
        }
        
        results.push({
            file: relPath,
            size,
            gzipped,
            issues,
            scriptCount: (content.match(/<script[^>]*src/g) || []).length,
            cssCount: (content.match(/<link[^>]*stylesheet/g) || []).length
        });
    }
    
    return {
        files: results,
        totalSize,
        count: files.length,
        issuesCount: results.reduce((sum, f) => sum + f.issues.length, 0)
    };
}

/**
 * Generate report
 */
function generateReport() {
    console.log('🔍 QScrap Performance Audit\n');
    console.log('Scanning public directory...\n');
    
    // Scan files
    const cssFiles = scanDirectory(path.join(PUBLIC_DIR, 'css'), ['.css']);
    const jsFiles = scanDirectory(path.join(PUBLIC_DIR, 'js'), ['.js']);
    const imageFiles = scanDirectory(PUBLIC_DIR, ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);
    const htmlFiles = scanDirectory(PUBLIC_DIR, ['.html']);
    
    // Analyze
    const cssAnalysis = analyzeCSS(cssFiles);
    const jsAnalysis = analyzeJS(jsFiles);
    const imageAnalysis = analyzeImages(imageFiles);
    const htmlAnalysis = analyzeHTML(htmlFiles);
    
    // Generate summary
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            totalFiles: cssAnalysis.count + jsAnalysis.count + imageAnalysis.count + htmlAnalysis.count,
            totalSize: cssAnalysis.totalSize + jsAnalysis.totalSize + imageAnalysis.totalSize + htmlAnalysis.totalSize,
            totalGzipped: cssAnalysis.totalGzipped + jsAnalysis.totalGzipped,
            compressionRatio: (((cssAnalysis.totalGzipped + jsAnalysis.totalGzipped) / (cssAnalysis.totalSize + jsAnalysis.totalSize)) * 100).toFixed(1)
        },
        css: cssAnalysis,
        js: jsAnalysis,
        images: imageAnalysis,
        html: htmlAnalysis,
        recommendations: []
    };
    
    // Generate recommendations
    if (cssAnalysis.minifiedCount < cssAnalysis.count) {
        report.recommendations.push({
            priority: 'high',
            category: 'CSS',
            issue: `${cssAnalysis.count - cssAnalysis.minifiedCount} CSS files not minified`,
            action: 'Run minification on all CSS files'
        });
    }
    
    if (jsAnalysis.minifiedCount < jsAnalysis.count) {
        report.recommendations.push({
            priority: 'high',
            category: 'JavaScript',
            issue: `${jsAnalysis.count - jsAnalysis.minifiedCount} JS files not minified`,
            action: 'Run minification on all JS files'
        });
    }
    
    if (imageAnalysis.webpCoverage < 50) {
        report.recommendations.push({
            priority: 'medium',
            category: 'Images',
            issue: `Only ${imageAnalysis.webpCoverage.toFixed(0)}% images have WebP variants`,
            action: 'Convert images to WebP format with fallbacks'
        });
    }
    
    if (htmlAnalysis.issuesCount > 0) {
        report.recommendations.push({
            priority: 'medium',
            category: 'HTML',
            issue: `${htmlAnalysis.issuesCount} optimization issues found`,
            action: 'Review and fix HTML optimization issues'
        });
    }
    
    // Save report
    const reportPath = path.join(REPORT_DIR, 'performance-audit.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Print summary
    console.log('📊 AUDIT SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total Files:     ${report.summary.totalFiles}`);
    console.log(`Total Size:      ${(report.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Gzipped Size:    ${(report.summary.totalGzipped / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Compression:     ${report.summary.compressionRatio}% average`);
    console.log();
    
    console.log('📁 BY TYPE');
    console.log('─'.repeat(60));
    console.log(`CSS:             ${cssAnalysis.count} files (${(cssAnalysis.totalSize / 1024).toFixed(1)} KB) - ${cssAnalysis.minifiedCount} minified`);
    console.log(`JavaScript:      ${jsAnalysis.count} files (${(jsAnalysis.totalSize / 1024).toFixed(1)} KB) - ${jsAnalysis.minifiedCount} minified`);
    console.log(`Images:          ${imageAnalysis.count} files (${(imageAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`HTML:            ${htmlAnalysis.count} files (${(htmlAnalysis.totalSize / 1024).toFixed(1)} KB)`);
    console.log();
    
    console.log('⚠️  RECOMMENDATIONS');
    console.log('─'.repeat(60));
    
    if (report.recommendations.length === 0) {
        console.log('✅ No critical issues found!');
    } else {
        for (const rec of report.recommendations) {
            const icon = rec.priority === 'high' ? '🔴' : '🟡';
            console.log(`${icon} [${rec.priority.toUpperCase()}] ${rec.category}: ${rec.issue}`);
            console.log(`   → ${rec.action}`);
        }
    }
    
    console.log();
    console.log(`📄 Full report saved to: ${reportPath}`);
    console.log();
    
    return report;
}

// Run audit
generateReport();
