#!/usr/bin/env node
/**
 * QScrap Critical CSS Extractor
 * Extracts above-the-fold CSS for faster initial page load
 * 
 * Usage: node scripts/optimize/extract-critical-css.js
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../public');
const OUTPUT_DIR = path.join(PUBLIC_DIR, 'css');

/**
 * Critical CSS selectors for homepage above-the-fold content
 */
const CRITICAL_SELECTORS = [
    // Reset & Base
    '*', '*::before', '*::after',
    'html', 'body',
    
    // Navigation
    '.nav', '.nav-container', '.nav-logo', '.nav-logo img',
    '.nav-links', '.nav-link', '.nav-cta',
    '.lang-switcher', '.lang-btn',
    '.mobile-menu-btn',
    
    // Hero Section
    '.hero', '.hero-container', '.hero-content',
    '.hero-badge', '.hero-title', '.hero-subtitle',
    '.hero-buttons', '.btn-hero-primary', '.btn-hero-secondary',
    '.hero-stats', '.hero-stat', '.hero-stat-value', '.hero-stat-label',
    '.hero-overlay',
    
    // Skip link
    '.skip-link',
    
    // Design tokens (essential)
    ':root',
    
    // Utilities
    '.container',
    '.sr-only',
    
    // Animations (essential)
    '@keyframes'
];

/**
 * Read CSS file
 */
function readCSS(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return '';
    }
}

/**
 * Extract critical CSS from full CSS
 */
function extractCriticalCSS(cssContent) {
    const criticalRules = [];
    
    // Split into rules
    const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    
    while ((match = ruleRegex.exec(cssContent)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2].trim();
        
        // Check if selector matches critical list
        const isCritical = CRITICAL_SELECTORS.some(critical => 
            selector.includes(critical) ||
            selector.startsWith(critical) ||
            critical.includes(selector.split(':')[0])
        );
        
        // Always include :root and keyframes
        if (selector.includes(':root') || selector.includes('@keyframes')) {
            criticalRules.push(`${selector}{${declarations}}`);
        } else if (isCritical) {
            criticalRules.push(`${selector}{${declarations}}`);
        }
    }
    
    // Add essential inline styles
    const essentialCSS = `
        /* Critical CSS - Above the fold styles */
        :root{--qatar-maroon:#8D1B3D;--qatar-maroon-dark:#6B1530;--qatar-maroon-light:#F5E6EB;--gold:#C9A227;--white:#FFFFFF;--black:#1A1A1A;--text-primary:#1A1A1A;--text-secondary:#3A3A3A;--shadow-md:0 4px 6px -1px rgba(0,0,0,0.05);--radius-md:8px;--radius-full:9999px;--transition-fast:150ms ease}
        *{margin:0;padding:0;box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--white);color:var(--text-primary);line-height:1.6}
        .skip-link{position:absolute;top:-100%;left:50%;transform:translateX(-50%);padding:8px 16px;background:var(--qatar-maroon);color:var(--white);border-radius:var(--radius-md);z-index:9999}
        .skip-link:focus{top:16px}
        .container{max-width:1280px;margin:0 auto;padding:0 24px}
        .nav{position:fixed;top:0;left:0;right:0;z-index:1000;background:#FFFFFF;transition:all 0.3s ease}
        .nav-container{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:72px}
        .nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none}
        .nav-logo img{max-height:50px;max-width:200px;height:auto;width:auto}
        .nav-links{display:flex;align-items:center;gap:32px}
        .nav-link{text-decoration:none;color:var(--text-secondary);font-weight:500;font-size:15px;transition:color 0.2s ease}
        .nav-link:hover{color:var(--qatar-maroon)}
        .nav-cta{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--qatar-maroon);color:var(--white);text-decoration:none;border-radius:var(--radius-full);font-weight:600;font-size:14px;transition:all 0.2s ease}
        .nav-cta:hover{background:var(--qatar-maroon-dark);transform:translateY(-1px)}
        .lang-switcher{display:flex;gap:4px;background:var(--qatar-maroon-lighter);border-radius:var(--radius-full);padding:4px}
        .lang-btn{padding:6px 12px;border:none;background:transparent;border-radius:var(--radius-full);font-size:13px;font-weight:500;cursor:pointer;color:var(--slate);transition:all 0.2s ease}
        .lang-btn.active{background:var(--white);color:var(--qatar-maroon);box-shadow:0 1px 2px rgba(0,0,0,0.05)}
        .mobile-menu-btn{display:none;padding:8px;background:none;border:none;cursor:pointer}
        .mobile-menu-btn span{display:block;width:24px;height:2px;background:var(--charcoal);margin:5px 0;transition:0.3s}
        .hero{min-height:100vh;background:linear-gradient(165deg,var(--qatar-maroon) 0%,var(--qatar-maroon-dark) 50%,#4A0E21 100%);position:relative;display:flex;align-items:center;overflow:hidden;padding-top:72px}
        .hero-container{max-width:1280px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;position:relative;z-index:1}
        .hero-content{color:var(--white)}
        .hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(201,162,39,0.2);border:1px solid var(--gold);border-radius:var(--radius-full);font-size:13px;font-weight:600;color:var(--gold);margin-bottom:24px}
        .hero-title{font-size:clamp(2.25rem,1rem + 5vw,4.5rem);font-weight:800;line-height:1.1;margin-bottom:24px;text-shadow:0 4px 30px rgba(0,0,0,0.3)}
        .hero-title span{color:var(--gold)}
        .hero-subtitle{font-size:clamp(1.125rem,1rem + 0.6vw,1.25rem);opacity:0.9;margin-bottom:16px;font-weight:400}
        .hero-buttons{display:flex;gap:16px;flex-wrap:wrap}
        .btn-hero-primary{display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:var(--gold);color:var(--black);text-decoration:none;border-radius:var(--radius-full);font-weight:700;font-size:16px;transition:all 0.3s ease;box-shadow:0 8px 30px rgba(201,162,39,0.4)}
        .btn-hero-primary:hover{background:var(--gold-dark);transform:translateY(-2px);box-shadow:0 12px 40px rgba(201,162,39,0.5)}
        .btn-hero-secondary{display:inline-flex;align-items:center;gap:10px;padding:16px 32px;background:rgba(255,255,255,0.1);color:var(--white);text-decoration:none;border-radius:var(--radius-full);font-weight:600;font-size:16px;transition:all 0.3s ease;border:1px solid rgba(255,255,255,0.2)}
        .btn-hero-secondary:hover{background:rgba(255,255,255,0.15);transform:translateY(-2px)}
        .hero-stats{display:flex;gap:32px;margin-top:48px}
        .hero-stat{text-align:center}
        .hero-stat-value{font-size:32px;font-weight:800;color:var(--gold)}
        .hero-stat-label{font-size:14px;opacity:0.8;margin-top:4px}
        .hero-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.2)}
    `;
    
    return essentialCSS + '\n' + criticalRules.join('\n');
}

/**
 * Main extraction function
 */
function extractCriticalCSSForPages() {
    console.log('🎯 QScrap Critical CSS Extraction\n');
    
    // Read main CSS files
    const designTokens = readCSS(path.join(OUTPUT_DIR, 'design-tokens.css'));
    const mainCSS = readCSS(path.join(OUTPUT_DIR, 'main.css'));
    const websiteCSS = readCSS(path.join(OUTPUT_DIR, 'website.css'));
    
    const fullCSS = designTokens + '\n' + mainCSS + '\n' + websiteCSS;
    
    // Extract critical CSS
    const criticalCSS = extractCriticalCSS(fullCSS);
    
    // Write critical CSS file
    const criticalCSSPath = path.join(OUTPUT_DIR, 'critical.css');
    fs.writeFileSync(criticalCSSPath, criticalCSS);
    
    const originalSize = fullCSS.length;
    const criticalSize = criticalCSS.length;
    const savings = ((1 - criticalSize / originalSize) * 100).toFixed(1);
    
    console.log(`📄 Critical CSS extracted`);
    console.log(`   Original: ${(originalSize / 1024).toFixed(1)} KB`);
    console.log(`   Critical: ${(criticalSize / 1024).toFixed(1)} KB`);
    console.log(`   Savings: ${savings}% (deferred loading)`);
    console.log();
    console.log(`💡 USAGE IN HTML:`);
    console.log('─'.repeat(60));
    console.log('<head>');
    console.log('  <!-- Critical CSS (inline for fast FCP) -->');
    console.log('  <style>');
    console.log('    /* Paste critical.css content here */');
    console.log('  </style>');
    console.log();
    console.log('  <!-- Non-critical CSS (deferred) -->');
    console.log('  <link rel="preload" href="/css/main.min.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">');
    console.log('  <link rel="preload" href="/css/website.min.css" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">');
    console.log('  <noscript>');
    console.log('    <link rel="stylesheet" href="/css/main.min.css">');
    console.log('    <link rel="stylesheet" href="/css/website.min.css">');
    console.log('  </noscript>');
    console.log('</head>');
    console.log();
    console.log(`✅ Critical CSS saved to: ${criticalCSSPath}`);
    console.log();
}

// Run extraction
extractCriticalCSSForPages();
