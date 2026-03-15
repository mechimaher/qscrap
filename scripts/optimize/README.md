# QScrap Performance Optimization Guide

## 🚀 Overview

This optimization suite provides surgical performance improvements without breaking existing functionality. All optimizations are non-destructive and preserve original files.

## 📦 Installation

```bash
# Install optimization dependencies
npm install -D clean-css terser sharp

# Verify installation
npm install
```

## 🛠️ Available Scripts

### Full Optimization Suite

```bash
# Run all optimizations in sequence
node scripts/optimize/optimize-all.js
```

### Individual Optimizations

```bash
# Performance audit
node scripts/optimize/performance-audit.js

# CSS minification
node scripts/optimize/optimize-css.js

# JavaScript minification
node scripts/optimize/optimize-js.js

# Image optimization (WebP conversion)
node scripts/optimize/optimize-images.js

# HTML minification
node scripts/optimize/optimize-html.js

# Critical CSS extraction
node scripts/optimize/extract-critical-css.js
```

## 📋 Optimization Checklist

### Phase 1: Audit (Run First)
- [ ] Run performance audit
- [ ] Review audit-output/performance-audit.json
- [ ] Identify bottlenecks

### Phase 2: Asset Optimization
- [ ] Minify CSS files
- [ ] Minify JavaScript files
- [ ] Convert images to WebP
- [ ] Minify HTML files
- [ ] Extract critical CSS

### Phase 3: Caching
- [ ] Deploy service worker (sw.js)
- [ ] Configure HTTP cache headers
- [ ] Test offline functionality

### Phase 4: Verification
- [ ] Run Lighthouse audit
- [ ] Test all pages function correctly
- [ ] Verify RTL/Arabic pages work
- [ ] Check mobile responsiveness

## 🎯 Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| First Contentful Paint | ~2.5s | ~0.8s | **68% faster** |
| Largest Contentful Paint | ~3.5s | ~1.2s | **66% faster** |
| Time to Interactive | ~4.0s | ~1.5s | **62% faster** |
| Total Bundle Size | ~500KB | ~150KB | **70% smaller** |
| Lighthouse Performance | ~65 | ~95+ | **+30 points** |

## 📁 File Structure

```
scripts/optimize/
├── optimize-all.js           # Main runner script
├── performance-audit.js      # Audit and reporting
├── optimize-css.js           # CSS minification
├── optimize-js.js            # JavaScript minification
├── optimize-images.js        # Image optimization
├── optimize-html.js          # HTML minification
└── extract-critical-css.js   # Critical CSS extraction

public/
├── sw.js                     # Service Worker
├── js/register-sw.js         # Service Worker registration
├── css/
│   ├── *.min.css             # Minified CSS (generated)
│   └── critical.css          # Critical CSS (generated)
└── assets/images/
    └── *.webp                # WebP images (generated)
```

## 🔧 Configuration

### CSS Minification Options

Located in `optimize-css.js`:
```javascript
const cssOptions = {
    level: 2,              // 0, 1, or 2 (2 = most aggressive)
    compatibility: '*',    // IE compatibility
    format: 'keep-breaks'  // Preserve line breaks
};
```

### Image Optimization Quality

Located in `optimize-images.js`:
```javascript
const quality = 80;  // WebP quality (0-100)
```

### Service Worker Cache Version

Located in `sw.js`:
```javascript
const CACHE_VERSION = 'v2026.01';  // Increment to bust cache
```

## 🌐 Service Worker Integration

### Add to HTML Pages

Include before closing `</body>` tag:

```html
<!-- Service Worker Registration -->
<script src="/js/register-sw.js" defer></script>
```

### HTTP Cache Headers

Configure your server with these headers:

```nginx
# Static assets (long cache)
location ~* \.(css|js|jpg|jpeg|png|gif|svg|webp|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML pages (short cache)
location ~* \.html$ {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
}

# Service Worker (no cache)
location = /sw.js {
    expires 0;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

## 📊 Critical CSS Usage

### For Homepage (index.html)

```html
<head>
    <!-- Critical CSS (inline for instant FCP) -->
    <style>
        /* Paste contents of public/css/critical.css here */
    </style>
    
    <!-- Preload non-critical CSS -->
    <link rel="preload" href="/css/design-tokens.min.css" as="style" 
          onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="/css/main.min.css" as="style" 
          onload="this.onload=null;this.rel='stylesheet'">
    <link rel="preload" href="/css/website.min.css" as="style" 
          onload="this.onload=null;this.rel='stylesheet'">
    
    <!-- Fallback for no-JS -->
    <noscript>
        <link rel="stylesheet" href="/css/design-tokens.min.css">
        <link rel="stylesheet" href="/css/main.min.css">
        <link rel="stylesheet" href="/css/website.min.css">
    </noscript>
</head>
```

## 🖼️ WebP Image Usage

### HTML Picture Element

```html
<picture>
    <source srcset="/assets/images/hero.webp" type="image/webp">
    <img src="/assets/images/hero.jpg" alt="Hero image" loading="lazy">
</picture>
```

### CSS Background with WebP

```css
.hero {
    background-image: url('/assets/images/hero.jpg');
}

@supports (background-image: url('/assets/images/hero.webp')) {
    .hero {
        background-image: url('/assets/images/hero.webp');
    }
}
```

## 🧪 Testing

### Lighthouse Audit

```bash
# Using Chrome DevTools
1. Open Chrome DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" category
4. Click "Analyze page load"
5. Review scores and recommendations
```

### Performance Monitoring

```javascript
// Add to pages for real-user monitoring
window.addEventListener('load', () => {
    if ('performance' in window && performance.getEntriesByType) {
        const navigation = performance.getEntriesByType('navigation')[0];
        console.log('Performance Metrics:', {
            DNS: navigation.domainLookupEnd - navigation.domainLookupStart,
            TCP: navigation.connectEnd - navigation.connectStart,
            TTFB: navigation.responseStart - navigation.requestStart,
            DOMContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
            Load: navigation.loadEventEnd - navigation.navigationStart
        });
    }
});
```

## 🐛 Troubleshooting

### Service Worker Not Registering

1. Check browser console for errors
2. Ensure sw.js is served from root (/sw.js)
3. Verify HTTPS (required for production)
4. Clear browser cache and reload

### Images Not Converting

1. Ensure sharp is installed: `npm install -D sharp`
2. Check file permissions
3. Verify source images are valid

### CSS Minification Errors

1. Check for syntax errors in source CSS
2. Review optimize-css.js output for specific errors
3. Try level 1 minification instead of level 2

## 📈 Monitoring

### Key Metrics to Track

- **FCP** (First Contentful Paint): Target < 1.0s
- **LCP** (Largest Contentful Paint): Target < 2.5s
- **TTI** (Time to Interactive): Target < 3.0s
- **CLS** (Cumulative Layout Shift): Target < 0.1
- **FID** (First Input Delay): Target < 100ms

### Tools

- Google Lighthouse
- WebPageTest.org
- Chrome DevTools Performance tab
- Google PageSpeed Insights

## 🔄 Continuous Optimization

### Weekly Tasks

- [ ] Run performance audit
- [ ] Check Lighthouse scores
- [ ] Review new images for optimization
- [ ] Monitor service worker cache hit rate

### Monthly Tasks

- [ ] Update CACHE_VERSION in sw.js
- [ ] Review and update critical CSS
- [ ] Audit third-party scripts
- [ ] Check for new optimization opportunities

## 📞 Support

For issues or questions:
- Check audit-output/ logs
- Review browser console
- Contact: support@qscrap.qa

---

**Last Updated:** 2026-03-15
**Version:** 2026.1.0
**Maintained By:** QScrap Development Team
