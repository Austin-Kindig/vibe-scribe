/**
 * PDF Handler - Manages PDF loading and rendering
 */

window.PDFHandler = {
    /**
     * Initialize PDF.js
     */
    init() {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        } else {
            // Retry after a short delay
            setTimeout(() => {
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                }
            }, 100);
        }
    },

    /**
     * Load PDF from file
     */
    async loadPDF(file) {
        try {
            // Check if PDF.js is available
            if (typeof pdfjsLib === 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF.js library not available. Please refresh the page.');
                }
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

            return {
                document: pdfDoc,
                totalPages: pdfDoc.numPages
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
    },

    /**
     * Render a specific page to canvas
     */
    async renderPage(pdfDoc, pageNum, scale = 2.0) {
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: scale });

            // Create canvas for PDF rendering
            const renderCanvas = document.createElement('canvas');
            const renderCtx = renderCanvas.getContext('2d');
            renderCanvas.width = viewport.width;
            renderCanvas.height = viewport.height;

            // Render PDF page to canvas
            await page.render({
                canvasContext: renderCtx,
                viewport: viewport
            }).promise;

            return {
                canvas: renderCanvas,
                width: viewport.width,
                height: viewport.height,
                dataUrl: renderCanvas.toDataURL()
            };
        } catch (error) {
            console.error('Error rendering page:', error);
            throw new Error(`Failed to render page ${pageNum}: ${error.message}`);
        }
    },

    /**
     * Create image element from canvas data URL
     */
    createImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    },

    /**
     * Render all pages of a PDF (for batch processing)
     */
    async renderAllPages(pdfDoc, scale = 2.0, progressCallback = null) {
        const totalPages = pdfDoc.numPages;
        const renderedPages = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            if (progressCallback) {
                progressCallback(pageNum, totalPages);
            }

            const pageData = await this.renderPage(pdfDoc, pageNum, scale);
            renderedPages.push(pageData);
        }

        return renderedPages;
    },

    /**
     * Get PDF metadata
     */
    async getPDFMetadata(pdfDoc) {
        try {
            const metadata = await pdfDoc.getMetadata();
            return {
                title: metadata.info.Title || 'Unknown',
                author: metadata.info.Author || 'Unknown',
                subject: metadata.info.Subject || '',
                creator: metadata.info.Creator || '',
                producer: metadata.info.Producer || '',
                creationDate: metadata.info.CreationDate || null,
                modificationDate: metadata.info.ModDate || null,
                pages: pdfDoc.numPages
            };
        } catch (error) {
            console.warn('Could not retrieve PDF metadata:', error);
            return {
                title: 'Unknown',
                author: 'Unknown',
                subject: '',
                creator: '',
                producer: '',
                creationDate: null,
                modificationDate: null,
                pages: pdfDoc.numPages
            };
        }
    }
};