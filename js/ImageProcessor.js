/**
 * Image Processor - Handles image cropping and processing
 */

window.ImageProcessor = {
    /**
     * Crop a region from a canvas with optional skew correction
     */
    async cropRegionFromCanvas(sourceCanvas, region, skewAngle = 0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Apply skew correction to source if needed
        let sourceImage = sourceCanvas;
        if (Math.abs(skewAngle) > 0.1) {
            sourceImage = Utils.applySkewCorrection(sourceCanvas, skewAngle);
        }

        // Set canvas size to region size
        canvas.width = region.width;
        canvas.height = region.height;

        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Crop the region
        ctx.drawImage(
            sourceImage,
            region.x, region.y, region.width, region.height,
            0, 0, region.width, region.height
        );

        return canvas;
    },

    /**
     * Process regions for a single image
     */
    async processSingleImage(image, regions, skewAngle, outputFormat, imageQuality, progressCallback) {
        const results = {
            files: [],
            total_slices: 0
        };

        // Create canvas from image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = image.width;
        tempCanvas.height = image.height;
        tempCtx.drawImage(image, 0, 0);

        const useZip = outputFormat === 'zip';
        let zip = null;

        if (useZip) {
            const JSZip = await Utils.loadJSZip();
            zip = new JSZip();
        }

        const baseName = 'document';

        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];

            if (progressCallback) {
                progressCallback(i + 1, regions.length, `Processing region ${i + 1}...`);
            }

            const croppedCanvas = await this.cropRegionFromCanvas(tempCanvas, region, skewAngle);
            const blob = await Utils.canvasToBlob(croppedCanvas, imageQuality);

            const safeRegionType = Utils.sanitizeFilename(region.type);
            const filename = `${baseName}_${safeRegionType}_${(i + 1).toString().padStart(2, '0')}.${Utils.getFileExtension(imageQuality)}`;

            if (useZip) {
                zip.file(filename, blob);
            } else {
                const url = URL.createObjectURL(blob);
                results.files.push({
                    filename: filename,
                    url: url,
                    type: region.type
                });
            }

            results.total_slices++;
        }

        if (useZip) {
            const zipBlob = await zip.generateAsync({type: 'blob'});
            const zipUrl = URL.createObjectURL(zipBlob);
            results.zipUrl = zipUrl;
            results.zipFilename = `${baseName}_slices.zip`;
        }

        return results;
    },

    /**
     * Process regions for a multi-page PDF
     */
    async processMultiPagePDF(originalPages, regionsData, outputFormat, imageQuality, progressCallback) {
        const results = {
            files: [],
            total_slices: 0
        };

        const useZip = outputFormat === 'zip';
        let zip = null;

        if (useZip) {
            const JSZip = await Utils.loadJSZip();
            zip = new JSZip();
        }

        const pdfName = Utils.sanitizeFilename(regionsData.pdf_name || 'document');
        const skewAngle = regionsData.skew || 0;

        // Calculate total regions for progress
        const totalRegions = Object.values(regionsData.pages || {}).reduce((sum, regions) => sum + regions.length, 0);
        let processedRegions = 0;

        for (let pageNum in regionsData.pages) {
            const regions = regionsData.pages[pageNum];
            if (regions.length === 0) continue;

            const pageIndex = parseInt(pageNum) - 1;
            const originalPage = originalPages[pageIndex];

            if (!originalPage) {
                console.warn(`Original page data not found for page ${pageNum}`);
                continue;
            }

            // Create page folder in ZIP
            const pageFolder = useZip ? `${pdfName}/page_${pageNum.padStart(3, '0')}/` : '';

            for (let i = 0; i < regions.length; i++) {
                const region = regions[i];
                processedRegions++;

                if (progressCallback) {
                    progressCallback(
                        processedRegions,
                        totalRegions,
                        `Processing page ${pageNum}, region ${i + 1}...`
                    );
                }

                const croppedCanvas = await this.cropRegionFromCanvas(
                    originalPage.canvas,
                    region,
                    skewAngle
                );

                const blob = await Utils.canvasToBlob(croppedCanvas, imageQuality);

                const safeRegionType = Utils.sanitizeFilename(region.type);
                const filename = `${pdfName}_page${pageNum.padStart(3, '0')}_${safeRegionType}_${(i + 1).toString().padStart(2, '0')}.${Utils.getFileExtension(imageQuality)}`;

                if (useZip) {
                    zip.file(pageFolder + filename, blob);
                } else {
                    const url = URL.createObjectURL(blob);
                    results.files.push({
                        filename: filename,
                        url: url,
                        type: region.type,
                        page: pageNum
                    });
                }

                results.total_slices++;
            }
        }

        if (useZip) {
            const zipBlob = await zip.generateAsync({type: 'blob'});
            const zipUrl = URL.createObjectURL(zipBlob);
            results.zipUrl = zipUrl;
            results.zipFilename = `${pdfName}_slices.zip`;
        }

        return results;
    },

    /**
     * Main processing function that routes to appropriate handler
     */
    async processRegions(regionsData, originalPages, outputFormat, imageQuality, progressCallback) {
        try {
            if (regionsData.pages) {
                // Multi-page PDF
                return await this.processMultiPagePDF(
                    originalPages,
                    regionsData,
                    outputFormat,
                    imageQuality,
                    progressCallback
                );
            } else {
                // Single image
                const regions = regionsData.regions || [];
                // For single images, we need to reconstruct the image from the current display
                // This is handled by the calling code
                throw new Error('Single image processing should be handled by the calling code');
            }
        } catch (error) {
            console.error('Error processing regions:', error);
            throw error;
        }
    },

    /**
     * Validate region data
     */
    validateRegion(region, imageWidth, imageHeight) {
        return (
            region.x >= 0 &&
            region.y >= 0 &&
            region.width > 0 &&
            region.height > 0 &&
            region.x + region.width <= imageWidth &&
            region.y + region.height <= imageHeight
        );
    },

    /**
     * Normalize region coordinates (handle negative dimensions)
     */
    normalizeRegion(region) {
        const normalized = { ...region };

        if (normalized.width < 0) {
            normalized.x += normalized.width;
            normalized.width = -normalized.width;
        }

        if (normalized.height < 0) {
            normalized.y += normalized.height;
            normalized.height = -normalized.height;
        }

        return normalized;
    },

    /**
     * Scale region coordinates
     */
    scaleRegion(region, scale) {
        return {
            ...region,
            x: region.x * scale,
            y: region.y * scale,
            width: region.width * scale,
            height: region.height * scale
        };
    }
};