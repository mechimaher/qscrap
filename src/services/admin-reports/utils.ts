/**
 * Admin Reports Service - Utilities
 */

export const getPeriodDates = (period: string): { start: Date; end: Date } => {
    const end = new Date();
    let start = new Date();

    switch (period) {
        case '7d':
            start.setDate(start.getDate() - 7);
            break;
        case '30d':
            start.setDate(start.getDate() - 30);
            break;
        case '90d':
            start.setDate(start.getDate() - 90);
            break;
        case '1y':
            start.setFullYear(start.getFullYear() - 1);
            break;
        case 'all':
        default:
            start = new Date('2020-01-01');
    }

    return { start, end };
};

export const formatCSV = (data: Record<string, unknown>[], columns: { key: string; label: string }[]): string => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const val = row[c.key];
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return str.includes(',') || str.includes('"') ? `"${str}"` : str;
        }).join(',')
    );
    return [header, ...rows].join('\n');
};

export interface PaginationParams {
    page?: number;
    limit?: number;
}

export interface PaginationResult {
    current_page: number;
    total_pages: number;
    total: number;
    limit: number;
}

export function getPagination(params: PaginationParams): { pageNum: number; limitNum: number; offset: number } {
    const pageNum = Math.max(1, Number(params.page || 1));
    const limitNum = Math.min(100, Math.max(1, Number(params.limit || 20)));
    const offset = (pageNum - 1) * limitNum;
    return { pageNum, limitNum, offset };
}
