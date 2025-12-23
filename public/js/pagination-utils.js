/**
 * Shared Pagination & Expandable Rows Utilities
 * Reusable components for all dashboards
 */

/**
 * Generate smart page numbers with ellipsis
 * Example: 1 ... 4 5 [6] 7 8 ... 20
 */
function getPageNumbers(current, total) {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = [1];

    if (current > 3) {
        pages.push('...');
    }

    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
    }

    if (current < total - 2) {
        pages.push('...');
    }

    if (total > 1) {
        pages.push(total);
    }

    return pages;
}

/**
 * Render pagination controls
 * @param {string} containerId - ID of container element
 * @param {object} pagination - { page, pages, total, limit }
 * @param {string} onPageChangeFn - Name of function to call on page change
 */
function renderPagination(containerId, pagination, onPageChangeFn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const { page, pages, total } = pagination;

    // Hide pagination if only 1 page
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';

    // Previous button
    html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} 
             onclick="${onPageChangeFn}(${page - 1})" 
             aria-label="Previous page">
             <i class="bi bi-chevron-left"></i>
             </button>`;

    // Page numbers
    const pageNumbers = getPageNumbers(page, pages);
    pageNumbers.forEach(num => {
        if (num === '...') {
            html += '<span class="page-ellipsis">...</span>';
        } else {
            html += `<button class="page-btn ${num === page ? 'active' : ''}" 
                     onclick="${onPageChangeFn}(${num})"
                     aria-label="Page ${num}"
                     ${num === page ? 'aria-current="page"' : ''}>${num}</button>`;
        }
    });

    // Next button
    html += `<button class="page-btn" ${page === pages ? 'disabled' : ''} 
             onclick="${onPageChangeFn}(${page + 1})"
             aria-label="Next page">
             <i class="bi bi-chevron-right"></i>
             </button>`;

    // Page info
    html += `<span class="page-info">Page ${page} of ${pages} (${total} total)</span>`;
    html += '</div>';

    container.innerHTML = html;
}

/**
 * Toggle expandable row
 * @param {string} rowId - Unique identifier for the row
 */
function toggleExpandableRow(rowId) {
    const detailsRow = document.getElementById(`details-${rowId}`);
    const icon = document.querySelector(`[data-expand="${rowId}"] .expand-icon`);

    if (!detailsRow || !icon) return;

    const isExpanded = detailsRow.style.display !== 'none';

    if (isExpanded) {
        // Collapse
        detailsRow.style.display = 'none';
        icon.classList.remove('expanded');
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    } else {
        // Expand
        detailsRow.style.display = 'table-row';
        icon.classList.add('expanded');
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    }
}

/**
 * Collapse all expandable rows
 */
function collapseAllRows() {
    document.querySelectorAll('.details-row').forEach(row => {
        row.style.display = 'none';
    });
    document.querySelectorAll('.expand-icon').forEach(icon => {
        icon.classList.remove('expanded', 'bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    });
}
