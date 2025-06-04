/**
 * RegionDetector - Auto-detection of region boundaries
 */

window.RegionDetector = {
    /**
     * Auto-detect regions based on template and image analysis
     */
    async autoDetectRegions(imageCanvas, templateRegions = [], options = {}) {
        const {
            threshold = 128,
            minRegionSize = 100,
            padding = 10,
            confidenceThreshold = 0.7
        } = options;

        try {
            // Get image data for analysis
            const ctx = imageCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

            // Convert to grayscale and create binary image
            const grayData = this.convertToGrayscale(imageData);
            const binaryData = this.createBinaryImage(grayData, threshold);

            // Find text regions using connected components
            const textRegions = this.findTextRegions(binaryData, imageCanvas.width, imageCanvas.height, minRegionSize);

            // If we have template regions, use them as a guide
            let suggestedRegions = [];
            if (templateRegions && templateRegions.length > 0) {
                suggestedRegions = this.refineTemplateRegions(templateRegions, textRegions, imageCanvas.width, imageCanvas.height);
            } else {
                // Create new regions from detected text areas
                suggestedRegions = this.createRegionsFromTextAreas(textRegions, imageCanvas.width, imageCanvas.height);
            }

            // Add confidence scores and cleanup
            suggestedRegions = this.scoreAndCleanupRegions(suggestedRegions, textRegions, confidenceThreshold);

            return {
                success: true,
                regions: suggestedRegions,
                metadata: {
                    textAreasFound: textRegions.length,
                    regionsProposed: suggestedRegions.length,
                    usedTemplate: templateRegions.length > 0
                }
            };

        } catch (error) {
            console.error('Auto-detection failed:', error);
            return {
                success: false,
                error: error.message,
                regions: []
            };
        }
    },

    /**
     * Convert image data to grayscale
     */
    convertToGrayscale(imageData) {
        const data = imageData.data;
        const grayData = new Uint8Array(data.length / 4);

        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            grayData[i / 4] = gray;
        }

        return grayData;
    },

    /**
     * Create binary image using threshold
     */
    createBinaryImage(grayData, threshold) {
        const binaryData = new Uint8Array(grayData.length);

        for (let i = 0; i < grayData.length; i++) {
            binaryData[i] = grayData[i] < threshold ? 0 : 255; // Text is dark (0), background is light (255)
        }

        return binaryData;
    },

    /**
     * Find text regions using simple connected components
     */
    findTextRegions(binaryData, width, height, minSize) {
        const visited = new Array(binaryData.length).fill(false);
        const regions = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                if (!visited[idx] && binaryData[idx] === 0) { // Found text pixel
                    const region = this.floodFill(binaryData, visited, x, y, width, height);

                    if (region.pixels.length > minSize) {
                        regions.push({
                            minX: region.minX,
                            minY: region.minY,
                            maxX: region.maxX,
                            maxY: region.maxY,
                            width: region.maxX - region.minX,
                            height: region.maxY - region.minY,
                            pixelCount: region.pixels.length
                        });
                    }
                }
            }
        }

        return regions;
    },

    /**
     * Flood fill to find connected text regions
     */
    floodFill(binaryData, visited, startX, startY, width, height) {
        const stack = [{x: startX, y: startY}];
        const pixels = [];
        let minX = startX, minY = startY, maxX = startX, maxY = startY;

        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const idx = y * width + x;

            if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || binaryData[idx] !== 0) {
                continue;
            }

            visited[idx] = true;
            pixels.push({x, y});

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            // Add 4-connected neighbors
            stack.push({x: x + 1, y}, {x: x - 1, y}, {x, y: y + 1}, {x, y: y - 1});
        }

        return {pixels, minX, minY, maxX, maxY};
    },

    /**
     * Refine template regions based on detected text
     */
    refineTemplateRegions(templateRegions, textRegions, canvasWidth, canvasHeight) {
        const refinedRegions = [];

        templateRegions.forEach(template => {
            // Find text regions that overlap with this template region
            const overlappingText = textRegions.filter(text =>
                this.regionsOverlap(template, text)
            );

            if (overlappingText.length > 0) {
                // Adjust template boundaries based on actual text
                const adjustedRegion = this.adjustRegionBoundaries(template, overlappingText);
                adjustedRegion.confidence = this.calculateConfidence(adjustedRegion, overlappingText);
                adjustedRegion.source = 'template_refined';
                refinedRegions.push(adjustedRegion);
            } else {
                // Keep original template but mark as low confidence
                const originalRegion = {...template};
                originalRegion.confidence = 0.3;
                originalRegion.source = 'template_only';
                refinedRegions.push(originalRegion);
            }
        });

        return refinedRegions;
    },

    /**
     * Create new regions from detected text areas
     */
    createRegionsFromTextAreas(textRegions, canvasWidth, canvasHeight) {
        // Group nearby text regions into larger areas
        const groupedRegions = this.groupNearbyRegions(textRegions);

        return groupedRegions.map((group, index) => ({
            x: group.minX,
            y: group.minY,
            width: group.width,
            height: group.height,
            type: this.guessRegionType(group, canvasWidth, canvasHeight),
            confidence: 0.6,
            source: 'auto_detected'
        }));
    },

    /**
     * Group nearby text regions together
     */
    groupNearbyRegions(textRegions, maxDistance = 50) {
        const groups = [];
        const used = new Array(textRegions.length).fill(false);

        textRegions.forEach((region, i) => {
            if (used[i]) return;

            const group = {
                minX: region.minX,
                minY: region.minY,
                maxX: region.maxX,
                maxY: region.maxY,
                regions: [region]
            };

            // Find nearby regions to group together
            textRegions.forEach((other, j) => {
                if (i === j || used[j]) return;

                const distance = this.calculateDistance(region, other);
                if (distance < maxDistance) {
                    used[j] = true;
                    group.minX = Math.min(group.minX, other.minX);
                    group.minY = Math.min(group.minY, other.minY);
                    group.maxX = Math.max(group.maxX, other.maxX);
                    group.maxY = Math.max(group.maxY, other.maxY);
                    group.regions.push(other);
                }
            });

            group.width = group.maxX - group.minX;
            group.height = group.maxY - group.minY;
            groups.push(group);
            used[i] = true;
        });

        return groups;
    },

    /**
     * Guess region type based on position and size
     */
    guessRegionType(region, canvasWidth, canvasHeight) {
        const centerX = region.minX + region.width / 2;
        const centerY = region.minY + region.height / 2;

        // Header detection (top 15% of image)
        if (centerY < canvasHeight * 0.15) {
            return 'header';
        }

        // Footer detection (bottom 15% of image)
        if (centerY > canvasHeight * 0.85) {
            return 'footer';
        }

        // Left vs right text (split at middle)
        if (centerX < canvasWidth * 0.5) {
            // Check if it's in the margin area (leftmost 20%)
            if (centerX < canvasWidth * 0.2) {
                return 'left-margin';
            }
            return 'left-text';
        } else {
            // Check if it's in the margin area (rightmost 20%)
            if (centerX > canvasWidth * 0.8) {
                return 'right-margin';
            }
            return 'right-text';
        }
    },

    /**
     * Check if two regions overlap
     */
    regionsOverlap(region1, region2) {
        return !(region1.x + region1.width < region2.minX ||
            region2.maxX < region1.x ||
            region1.y + region1.height < region2.minY ||
            region2.maxY < region1.y);
    },

    /**
     * Adjust region boundaries based on detected text
     */
    adjustRegionBoundaries(template, textRegions) {
        let minX = template.x;
        let minY = template.y;
        let maxX = template.x + template.width;
        let maxY = template.y + template.height;

        // Expand to include all overlapping text
        textRegions.forEach(text => {
            minX = Math.min(minX, text.minX - 5); // Small padding
            minY = Math.min(minY, text.minY - 5);
            maxX = Math.max(maxX, text.maxX + 5);
            maxY = Math.max(maxY, text.maxY + 5);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            type: template.type || 'unknown'
        };
    },

    /**
     * Calculate confidence score for a region
     */
    calculateConfidence(region, textRegions) {
        if (textRegions.length === 0) return 0.2;

        // Base confidence on text density and coverage
        const regionArea = region.width * region.height;
        const textArea = textRegions.reduce((sum, text) => sum + (text.width * text.height), 0);
        const coverage = Math.min(textArea / regionArea, 1);

        return Math.max(0.1, Math.min(0.95, coverage * 0.8 + 0.2));
    },

    /**
     * Calculate distance between two regions
     */
    calculateDistance(region1, region2) {
        const centerX1 = region1.minX + region1.width / 2;
        const centerY1 = region1.minY + region1.height / 2;
        const centerX2 = region2.minX + region2.width / 2;
        const centerY2 = region2.minY + region2.height / 2;

        return Math.sqrt((centerX1 - centerX2) ** 2 + (centerY1 - centerY2) ** 2);
    },

    /**
     * Score and cleanup regions
     */
    scoreAndCleanupRegions(regions, textRegions, confidenceThreshold) {
        return regions
            .filter(region => region.confidence >= confidenceThreshold)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 20); // Limit to top 20 regions
    }
};