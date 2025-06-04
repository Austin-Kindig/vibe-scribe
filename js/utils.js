/**
 * Utility functions for the OCR Region Editor
 */

window.Utils = {
    /**
     * Sanitize filename for filesystem compatibility
     */
    sanitizeFilename(filename) {
        // Remove file extension and sanitize
        const name = filename.split('.').slice(0, -1).join('.');
        // Replace problematic characters
        const safeChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
        let sanitized = '';
        for (let char of name) {
            sanitized += safeChars.includes(char) ? char : '_';
        }
        // Remove consecutive underscores and trim
        while (sanitized.includes('__')) {
            sanitized = sanitized.replace('__', '_');
        }
        return sanitized.replace(/^_+|_+$/g, '');
    },

    /**
     * Download a blob as a file
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Convert canvas to blob
     */
    async canvasToBlob(canvas, quality = 'high') {
        return new Promise((resolve) => {
            if (quality === 'high') {
                canvas.toBlob(resolve, 'image/png');
            } else {
                const jpegQuality = quality === 'medium' ? 0.9 : 0.7;
                canvas.toBlob(resolve, 'image/jpeg', jpegQuality);
            }
        });
    },

    /**
     * Get file extension based on quality setting
     */
    getFileExtension(quality) {
        return quality === 'high' ? 'png' : 'jpg';
    },

    /**
     * Dynamically load JSZip library
     */
    async loadJSZip() {
        if (window.JSZip) {
            return window.JSZip;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Apply skew correction to a canvas
     */
    applySkewCorrection(sourceCanvas, skewAngle) {
        if (Math.abs(skewAngle) < 0.1) {
            return sourceCanvas;
        }

        const rotatedCanvas = document.createElement('canvas');
        const rotatedCtx = rotatedCanvas.getContext('2d');

        // Calculate rotated canvas size
        const radians = (-skewAngle * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        const newWidth = sourceCanvas.width * cos + sourceCanvas.height * sin;
        const newHeight = sourceCanvas.width * sin + sourceCanvas.height * cos;

        rotatedCanvas.width = newWidth;
        rotatedCanvas.height = newHeight;

        rotatedCtx.translate(newWidth / 2, newHeight / 2);
        rotatedCtx.rotate(radians);
        rotatedCtx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);

        return rotatedCanvas;
    },

    /**
     * Check if a point is inside a rectangle
     */
    pointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width &&
            y >= rect.y && y <= rect.y + rect.height;
    },

    /**
     * Generate random color for custom region types
     */
    generateRandomColor() {
        const r = Math.floor(Math.random() * 255);
        const g = Math.floor(Math.random() * 255);
        const b = Math.floor(Math.random() * 255);
        return `rgba(${r}, ${g}, ${b}, 0.3)`;
    },

    /**
     * Format timestamp for display
     */
    formatTimestamp(isoString) {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        return date.toLocaleString();
    },

    /**
     * Debounce function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Show/hide element
     */
    toggleElement(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    },

    /**
     * Update element text content safely
     */
    updateText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    },

    /**
     * Update element HTML content safely
     */
    updateHTML(elementId, html) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = html;
        }
    },

    /**
     * Add event listener with error handling
     */
    addSafeEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
            return true;
        }
        console.warn(`Element ${elementId} not found for event listener`);
        return false;
    },

    /**
     * Region color definitions
     */
    REGION_COLORS: {
        'left-text': 'rgba(0, 122, 204, 0.3)',
        'right-text': 'rgba(0, 122, 204, 0.3)',
        'left-margin': 'rgba(255, 193, 7, 0.3)',
        'right-margin': 'rgba(255, 193, 7, 0.3)',
        'header': 'rgba(40, 167, 69, 0.3)',
        'footer': 'rgba(108, 117, 125, 0.3)',
        'custom': 'rgba(147, 51, 234, 0.3)'
    },

    /**
     * Default region types
     */
    DEFAULT_REGION_TYPES: [
        { value: 'left-text', label: 'Left Text' },
        { value: 'right-text', label: 'Right Text' },
        { value: 'left-margin', label: 'Left Margin' },
        { value: 'right-margin', label: 'Right Margin' },
        { value: 'header', label: 'Header' },
        { value: 'footer', label: 'Footer' }
    ]
};