/**
 * Sanitize text to prevent XSS
 */
export const sanitizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
};

/**
 * Sanitize URL to prevent javascript: and data: URLs
 */
export const sanitizeUrl = (url: string | null | undefined): string => {
    if (!url) return '';

    const cleaned = url.trim().toLowerCase();

    // Block dangerous URL schemes
    if (
        cleaned.startsWith('javascript:') ||
        cleaned.startsWith('data:') ||
        cleaned.startsWith('vbscript:')
    ) {
        return '';
    }

    return url.trim();
};

/**
 * Sanitize HTML by stripping potentially dangerous tags
 */
export const sanitizeHtml = (html: string | null | undefined): string => {
    if (!html) return '';

    // Remove script tags
    let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    cleaned = cleaned.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Remove javascript: URLs
    cleaned = cleaned.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');

    // Remove style tags
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove iframe tags
    cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    return cleaned.trim();
};

/**
 * Sanitize object - recursively sanitize all string values
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = sanitizeText(value);
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) =>
                typeof item === 'string'
                    ? sanitizeText(item)
                    : typeof item === 'object' && item !== null
                        ? sanitizeObject(item as Record<string, unknown>)
                        : item
            );
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }

    return result as T;
};

/**
 * Validate and sanitize slug
 */
export const sanitizeSlug = (slug: string | null | undefined): string => {
    if (!slug) return '';

    // Only allow alphanumeric, hyphens, and underscores
    return slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-_]/g, '')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '');
};
