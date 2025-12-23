/**
 * DOM Utilities - Safe HTML Rendering
 * 
 * Use these functions instead of innerHTML to prevent XSS attacks
 */

/**
 * Escape HTML special characters
 * @param {string} text - User-provided text
 * @returns {string} - Escaped text safe for HTML
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create element with safe text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {string} className - Optional CSS class
 * @returns {HTMLElement}
 */
function createTextElement(tag, text, className = '') {
    const el = document.createElement(tag);
    el.textContent = text || '';
    if (className) el.className = className;
    return el;
}

/**
 * Safely set inner HTML only for trusted content
 * For user-generated content, use createTextElement instead
 * @param {HTMLElement} element
 * @param {string} html - TRUSTED html only (no user input!)
 */
function setTrustedHTML(element, html) {
    // This should ONLY be used for static UI elements, not user data
    element.innerHTML = html;
}

/**
 * Clear element and append children safely
 * @param {HTMLElement} parent
 * @param {HTMLElement[]} children
 */
function replaceChildren(parent, children) {
    parent.textContent = ''; // Safe clear
    children.forEach(child => parent.appendChild(child));
}
