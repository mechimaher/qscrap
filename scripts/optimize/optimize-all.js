#!/usr/bin/env node
/**
 * QScrap Performance Optimization Runner
 * Executes all optimization scripts in sequence
 * 
 * Usage: node scripts/optimize/optimize-all.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPTS_DIR = __dirname;
const ROOT_DIR = path.join(__dirname, '../..');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * Run a script and capture output
 */
function runScript(scriptName, description) {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    if (!fs.existsSync(scriptPath)) {
        console.log(`${colors.yellow}⚠️  Skipping: ${description} (script not found)${colors.reset}`);
        return false;
    }
    
    console.log(`\n${colors.cyan}┌${'─'.repeat(58)}┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} ${colors.bright}${description.padEnd(56)}${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}└${'─'.repeat(58)}┘${colors.reset}\n`);
    
    try {
        const output = execSync(`node "${scriptPath}"`, {
            encoding: 'utf8',
            cwd: ROOT_DIR,
            stdio: 'inherit'
        });
        
        console.log(`\n${colors.green}✅ ${description} - Complete${colors.reset}\n`);
        return true;
    } catch (error) {
        console.error(`\n${colors.yellow}⚠️  ${description} - Had errors (continuing...)${colors.reset}\n`);
        return false;
    }
}

/**
 * Check dependencies
 */
function checkDependencies() {
    console.log(`${colors.bright}Checking dependencies...${colors.reset}\n`);
    
    const required = ['clean-css'];
    const optional = ['terser', 'sharp'];
    const missing = [];
    
    for (const pkg of required) {
        try {
            require.resolve(pkg);
            console.log(`${colors.green}✓${colors.reset} ${pkg}`);
        } catch {
            missing.push(pkg);
            console.log(`${colors.yellow}✗${colors.reset} ${pkg} (required)`);
        }
    }
    
    for (const pkg of optional) {
        try {
            require.resolve(pkg);
            console.log(`${colors.green}✓${colors.reset} ${pkg}`);
        } catch {
            console.log(`${colors.yellow}○${colors.reset} ${pkg} (optional)`);
        }
    }
    
    if (missing.length > 0) {
        console.log(`\n${colors.yellow}Install missing dependencies with:${colors.reset}`);
        console.log(`  npm install -D ${missing.join(' ')}`);
        console.log(`  npm install -D ${optional.join(' ')}  (recommended)\n`);
    }
    
    console.log();
}

/**
 * Generate optimization report
 */
function generateReport(results) {
    const reportPath = path.join(ROOT_DIR, 'audit-output', 'optimization-report.json');
    const reportDir = path.dirname(reportPath);
    
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const report = {
        timestamp: new Date().toISOString(),
        scripts: results,
        summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${colors.cyan}📄 Report saved to: ${reportPath}${colors.reset}\n`);
}

/**
 * Main optimization runner
 */
function runAllOptimizations() {
    console.log(`${colors.bright}${colors.magenta}`);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     QScrap Performance Optimization Suite                ║');
    console.log('║     Version: 2026.1.0                                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}\n`);
    
    // Check dependencies
    checkDependencies();
    
    const results = [];
    
    // Run audit first
    results.push({
        name: 'performance-audit',
        success: runScript('performance-audit.js', '📊 Performance Audit')
    });
    
    // Run CSS optimization
    results.push({
        name: 'optimize-css',
        success: runScript('optimize-css.js', '🎨 CSS Minification')
    });
    
    // Run JS optimization
    results.push({
        name: 'optimize-js',
        success: runScript('optimize-js.js', '⚡ JavaScript Minification')
    });
    
    // Run image optimization
    results.push({
        name: 'optimize-images',
        success: runScript('optimize-images.js', '🖼️  Image Optimization (WebP)')
    });
    
    // Generate final report
    generateReport(results);
    
    // Summary
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`${colors.bright}${colors.magenta}`);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                  OPTIMIZATION SUMMARY                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`${colors.reset}`);
    console.log(`\n${colors.bright}Completed: ${successful}/${total} scripts${colors.reset}\n`);
    
    if (successful === total) {
        console.log(`${colors.green}🎉 All optimizations completed successfully!${colors.reset}\n`);
    } else {
        console.log(`${colors.yellow}⚠️  Some optimizations had issues. Check the logs above.${colors.reset}\n`);
    }
    
    // Next steps
    console.log(`${colors.cyan}📋 NEXT STEPS:${colors.reset}`);
    console.log('─'.repeat(60));
    console.log('1. Review the audit report in audit-output/');
    console.log('2. Test the optimized assets in staging');
    console.log('3. Deploy to production');
    console.log('4. Monitor performance with Lighthouse');
    console.log();
}

// Run
runAllOptimizations();
