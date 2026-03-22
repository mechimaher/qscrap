#!/usr/bin/env node
/**
 * QScrap HTML Update Script
 * Updates HTML files to use minified CSS/JS and registers Service Worker
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../../public');

function updateHTMLFiles() {
    console.log('📄 Updating HTML files for performance optimization...\n');
    
    const files = fs.readdirSync(PUBLIC_DIR).filter(f => f.endsWith('.html'));
    
    files.forEach(file => {
        const filePath = path.join(PUBLIC_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // 1. Update CSS links to use .min.css
        // Matches href="/css/filename.css" or href="/css/filename.css?v=..."
        const cssRegex = /href="(\/css\/[^"]+)\.css(\?[^"]+)?"/g;
        if (cssRegex.test(content)) {
            content = content.replace(cssRegex, (match, p1) => {
                // Don't replace if it's already minified
                if (p1.endsWith('.min')) return match;
                
                // Check if .min.css exists
                const minFile = path.join(PUBLIC_DIR, `${p1}.min.css`);
                if (fs.existsSync(minFile)) {
                    modified = true;
                    return `href="${p1}.min.css"`;
                }
                return match;
            });
        }
        
        // 2. Update JS links to use .min.js
        // Matches src="/js/filename.js" or src="/js/filename.js?v=..."
        // Excludes known minified or specific files
        const jsRegex = /src="(\/js\/(?!chart|tsparticles)[^"]+)\.js(\?[^"]+)?"/g;
        if (jsRegex.test(content)) {
            content = content.replace(jsRegex, (match, p1) => {
                // Don't replace if it's already minified
                if (p1.endsWith('.min')) return match;
                
                // Check if .min.js exists
                const minFile = path.join(PUBLIC_DIR, `${p1}.min.js`);
                if (fs.existsSync(minFile)) {
                    modified = true;
                    return `src="${p1}.min.js"`;
                }
                return match;
            });
        }
        
        // 3. Update Images to use WebP (specifically the logo, including bilingual)
        const logoRegex = /src="\/assets\/images\/(qscrap-logo(?:-ar)?)\.png(\?v=[^"]+)?"/g;
        if (logoRegex.test(content)) {
            content = content.replace(logoRegex, 'src="/assets/images/$1.webp"');
            modified = true;
        }

        // 4. Fix Preload mismatch for logo
        // This addresses the user's specific warning and bilingual variants
        const preloadLogoRegex = /<link rel="preload" as="image" href="\/assets\/images\/qscrap-logo(?:-ar)?\.(png|webp)"([^>]*)>/g;
        if (preloadLogoRegex.test(content)) {
            // Determine which version to preload based on whether the page seems to be Arabic
            const isArabic = file.includes('-ar') || content.includes('lang="ar"');
            const targetLogo = isArabic ? 'qscrap-logo-ar.webp' : 'qscrap-logo.webp';
            content = content.replace(preloadLogoRegex, `<link rel="preload" as="image" href="/assets/images/${targetLogo}" transition-style="fade-in" fetchpriority="high">`);
            modified = true;
        }

        // 5. Add width/height to known large images to fix CLS
        // This is a surgical fix for the hero and common images
        const imgDimensions = {
            'qscrap-logo.webp': { w: 200, h: 60 },
            'qscrap-logo-ar.webp': { w: 200, h: 60 },
            'hero-car-parts.webp': { w: 1920, h: 1080 }
        };

        Object.entries(imgDimensions).forEach(([img, dim]) => {
            const regex = new RegExp(`src="[^"]*${img}"(?![^>]*width=)`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, `src="/assets/images/${img}" width="${dim.w}" height="${dim.h}"`);
                modified = true;
            }
        });

        // 5. Fix QR Code 503 Errors (Switch to QuickChart as fallback/alternative)
        if (content.includes('qrserver.com')) {
            content = content.replace(/https:\/\/api\.qrserver\.com\/v1\/create-qr-code\/\?size=120x120&data=([^&]+)&bgcolor=ffffff&color=8D1B3D&format=svg/g, 
                'https://quickchart.io/qr?size=120&text=$1&light=ffffff&dark=8D1B3D');
            modified = true;
        }

        // 6. Register Service Worker before </body>
        if (!content.includes('register-sw.min.js') && !content.includes('register-sw.js') && content.includes('</body>')) {
            const swRegistration = '\n    <!-- Service Worker for Offline Support & Caching -->\n    <script src="/js/register-sw.min.js" defer></script>\n';
            content = content.replace('</body>', swRegistration + '</body>');
            modified = true;
        } else if (content.includes('register-sw.js')) {
            content = content.replace('register-sw.js', 'register-sw.min.js');
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Updated ${file}`);
        } else {
            console.log(`ℹ️  No changes needed for ${file}`);
        }
    });
    
    console.log('\n✨ HTML optimization complete!');
}

updateHTMLFiles();
