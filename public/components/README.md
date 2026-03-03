# QScrap Footer Component System v2026.1

## Overview
Enterprise-grade reusable footer component with dynamic loading, retry logic, and automatic i18n support. Ensures consistency across all pages with single-point updates.

## 📁 Files
```
/public/components/footer.html          # Footer HTML template (v2026.1)
/public/js/components/footer-loader.js  # Dynamic loader with retry logic
/public/css/main.css                    # Footer styles
```

## 🚀 Usage

### Standard Implementation
Add this to any page before `</body>`:

```html
<!-- Footer Component Container -->
<footer id="footer-container" aria-label="Site footer"></footer>

<!-- Footer Loader Script -->
<script src="/js/components/footer-loader.js" defer></script>
```

### Server-Side Include (Alternative)
```php
<!-- PHP -->
<footer id="footer-container"></footer>
<?php include 'components/footer.html'; ?>
```

```html
<!-- Node.js/Express (EJS) -->
<footer id="footer-container"></footer>
<%- include('components/footer.html') %>
```

```html
<!-- Python/Flask (Jinja2) -->
<footer id="footer-container"></footer>
{% include 'components/footer.html' %}
```

## ✨ Features

### Core Features
✅ **Single Source of Truth** - Modify once, updates everywhere automatically
✅ **Dynamic Loading** - Fetches footer HTML asynchronously
✅ **Retry Logic** - 3 automatic retry attempts with 1s delay
✅ **Loading State** - Shows "Loading..." indicator during fetch
✅ **Graceful Fallback** - Minimal footer displayed if all retries fail
✅ **Versioned Caching** - Query string versioning (`?v=2026.1`) prevents stale cache
✅ **Semantic HTML5** - Proper `<footer>` element with ARIA labels
✅ **SEO Optimized** - Search engine friendly structure

### Internationalization
✅ **i18n Ready** - Automatic translation support for English/Arabic
✅ **RTL Support** - Automatic layout mirroring for Arabic (`dir="rtl"`)
✅ **Language Visibility** - Shows only active language (English OR Arabic)
✅ **Auto Re-translation** - Re-applies translations when footer loads

### Developer Experience
✅ **Custom Events** - `footer:loaded` event for integration
✅ **Global API** - `window.QScrapFooter` for manual control
✅ **Console Logging** - Debug-friendly error messages
✅ **Error Handling** - Comprehensive error reporting

## 🎨 Customization

### To Modify Footer Content
1. Edit `/public/components/footer.html`
2. Update version comment: `<!-- QScrap Footer Component v2026.1 -->`
3. Changes automatically apply to all pages

### To Modify Footer Styles
1. Edit `/public/css/main.css` (search for `.footer` selectors)
2. Changes apply site-wide immediately

### To Add/Remove Footer Links
1. Edit `/public/components/footer.html`
2. Add corresponding translation keys to your page's i18n object
3. Test in both English and Arabic

## 📦 Translation Keys Required

```javascript
// English (en)
{
    'footer.tagline': "Qatar's premium automotive parts marketplace...",
    'footer.company': 'Company',
    'footer.legal': 'Legal',
    'footer.contact': 'Contact',
    'footer.aboutUs': 'About Us',
    'footer.forBusiness': 'For Businesses',
    'footer.howItWorks': 'How It Works',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
    'footer.refund': 'Refund Policy',
    'footer.email': '📧 support@qscrap.qa',
    'footer.phone': '📞 +974 5026 7974',
    'footer.whatsapp': '💬 WhatsApp Support',
    'footer.legalInfo.en': 'QScrap Services & Trading L.L.C | Doha, Qatar',
    'footer.legalInfo.ar': 'كيوسكراب للخدمات والتجارة ذ.م.م | الدوحة، قطر',
    'footer.copyright': '© 2026 QScrap. All rights reserved.',
}

// Arabic (ar) - Corresponding Arabic translations
```

## 🔧 API Reference

### Global Object
```javascript
window.QScrapFooter = {
    load: Function,    // Manually load footer
    reload: Function,  // Reload with full retry attempts
    version: String    // Current version (e.g., "2026.1")
}
```

### Custom Events
```javascript
// Listen for footer load
document.addEventListener('footer:loaded', (event) => {
    console.log('Footer loaded:', event.detail.version);
    
    // Example: Track analytics
    if (window.gtag) {
        gtag('event', 'footer_view', { event_category: 'engagement' });
    }
});
```

### Manual Reload
```javascript
// Reload footer (e.g., after language change)
window.QScrapFooter.reload();
```

## 📄 Pages Using Footer Component

| Page | Status | Implementation |
|------|--------|----------------|
| `index.html` | ✅ Active | Dynamic loader |
| `request.html` | ✅ Active | Dynamic loader |
| `about.html` | ✅ Active | Dynamic loader |
| `partners.html` | ✅ Active | Dynamic loader |
| `terms.html` | ⏳ Pending | Migration needed |
| `privacy.html` | ⏳ Pending | Migration needed |
| `refund.html` | ⏳ Pending | Migration needed |

## 🐛 Troubleshooting

### Footer Not Showing?

**Check 1:** Is the loader script included?
```html
<script src="/js/components/footer-loader.js" defer></script>
```

**Check 2:** Does the container exist?
```html
<footer id="footer-container" aria-label="Site footer"></footer>
```

**Check 3:** Check browser console for errors
```javascript
// Look for: [Footer Loader] Error loading footer
```

**Check 4:** Verify file exists
```bash
curl -I https://qscrap.qa/components/footer.html
# Should return: HTTP/2 200
```

### Translations Not Working?

**Check 1:** Ensure translation keys exist
```javascript
console.log(window.translations.en.footer.legalInfo);
```

**Check 2:** Verify i18n initialized before footer loads
```javascript
// Footer loader waits for window.translations automatically
```

**Check 3:** Check language attribute
```javascript
console.log(localStorage.getItem('qscrap-lang')); // Should be 'en' or 'ar'
```

### Both Languages Showing?

**Fix:** Verify CSS rules in `main.css`
```css
.footer-legal-ar { display: none; }
html[dir="rtl"] .footer-legal-en { display: none; }
html[dir="rtl"] .footer-legal-ar { display: inline; }
```

**Check:** HTML dir attribute
```javascript
console.log(document.documentElement.getAttribute('dir')); // 'ltr' or 'rtl'
```

### Caching Issues?

**Solution:** Update version in `footer-loader.js`
```javascript
const FOOTER_VERSION = '2026.2'; // Increment version
```

**Force Clear Cache:**
```bash
# In browser DevTools
Application > Storage > Clear Site Data
```

## 🎯 Best Practices

1. **Always use the component** - Never duplicate footer HTML across pages
2. **Version on changes** - Update `FOOTER_VERSION` when modifying footer
3. **Test both languages** - Verify English and Arabic display correctly
4. **Check mobile responsiveness** - Footer should stack properly on small screens
5. **Monitor console logs** - Catch errors early in development
6. **Use semantic HTML** - Keep `<footer>` element with ARIA labels
7. **Respect loading state** - Don't hide `.footer-loading` via CSS

## 📊 Performance

- **Load Time:** < 50ms (cached), < 200ms (fresh fetch)
- **Retry Delay:** 1000ms between attempts
- **Max Retries:** 3 attempts
- **Fallback:** Displays after ~3.5s if all retries fail

## 🔒 Security

- **No External Dependencies** - Pure vanilla JavaScript
- **CORS Safe** - Same-origin policy enforced
- **XSS Protection** - InnerHTML only for trusted local files
- **Error Isolation** - Failures don't break page functionality

## 📝 Changelog

### v2026.1 (2026-03-01)
- ✨ Added retry logic (3 attempts with 1s delay)
- ✨ Added loading state indicator
- ✨ Added versioned caching (`?v=2026.1`)
- ✨ Added custom event (`footer:loaded`)
- ✨ Added global API (`window.QScrapFooter`)
- ♿ Improved accessibility with semantic `<footer>` element
- 🌐 Enhanced i18n auto re-translation
- 🐛 Added graceful fallback for network failures

### v2026.0 (2026-02-28)
- 🎉 Initial release
- ✨ Dynamic footer loading
- 🌐 Basic i18n support

## 📞 Support

For issues or questions:
- Check browser console for `[Footer Loader]` logs
- Review this documentation
- Contact: support@qscrap.qa

---

**Last Updated:** 2026-03-01  
**Component Version:** 2026.1  
**Maintained By:** QScrap Development Team
