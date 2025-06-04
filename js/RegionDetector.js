/**
 * RegionDetector - Enhanced auto-detection of region boundaries with template guidance
 */

window.RegionDetector = {
    /**
     * Auto-detect regions based on template and image analysis with configuration
     */
    async autoDetectRegions(imageCanvas, templateRegions = [], options = {}) {
        const {
            threshold = 128,
            minRegionSize = 100,
            padding = 10,
            confidenceThreshold = 0.5,
            useTemplateGuidance = true,
            detectionLog = null,
            preventOverlap = true,
            overlapTolerance = 5,
            templateAdherence = 0.7,
            regionTypeConfig = {}
        } = options;

        try {
            console.log('Starting auto-detection with', templateRegions.length, 'template regions');

            // Get image data for analysis
            const ctx = imageCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);

            // Convert to grayscale and create binary image
            const grayData = this.convertToGrayscale(imageData);
            const binaryData = this.createBinaryImage(grayData, threshold);

            // Find text regions using connected components
            const textRegions = this.findTextRegions(binaryData, imageCanvas.width, imageCanvas.height, minRegionSize);

            console.log('Found', textRegions.length, 'text regions');

            // Log text regions if log object provided
            if (detectionLog) {
                detectionLog.textRegions = textRegions.map(region => ({
                    x: region.minX,
                    y: region.minY,
                    width: region.width,
                    height: region.height,
                    pixelCount: region.pixelCount,
                    density: Math.round(region.density * 1000) / 1000
                }));
            }

            let suggestedRegions = [];

            if (useTemplateGuidance && templateRegions && templateRegions.length > 0) {
                // Template-guided detection with configuration
                suggestedRegions = this.refineTemplateRegionsWithConfig(
                    templateRegions,
                    textRegions,
                    imageCanvas.width,
                    imageCanvas.height,
                    templateAdherence,
                    regionTypeConfig
                );
                console.log('Template-guided detection produced', suggestedRegions.length, 'regions');
            } else {
                // Create new regions from detected text areas
                suggestedRegions = this.createRegionsFromTextAreas(textRegions, imageCanvas.width, imageCanvas.height);
                console.log('Automatic detection produced', suggestedRegions.length, 'regions');
            }

            // Apply region-specific confidence filtering
            suggestedRegions = this.applyRegionSpecificFiltering(suggestedRegions, regionTypeConfig, confidenceThreshold);

            // Prevent overlaps if enabled
            if (preventOverlap) {
                suggestedRegions = this.preventRegionOverlaps(suggestedRegions, overlapTolerance);
                console.log('After overlap prevention:', suggestedRegions.length, 'regions');
            }

            // Final cleanup and sorting
            suggestedRegions = this.scoreAndCleanupRegions(suggestedRegions, textRegions, confidenceThreshold);

            return {
                success: true,
                regions: suggestedRegions,
                metadata: {
                    textAreasFound: textRegions.length,
                    regionsProposed: suggestedRegions.length,
                    usedTemplate: useTemplateGuidance && templateRegions.length > 0,
                    templateCount: templateRegions.length,
                    overlapsPrevented: preventOverlap,
                    settings: {
                        threshold,
                        minRegionSize,
                        confidenceThreshold,
                        templateAdherence
                    }
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
     * Enhanced template region refinement with configuration
     */
    refineTemplateRegionsWithConfig(templateRegions, textRegions, canvasWidth, canvasHeight, templateAdherence, regionTypeConfig) {
        const refinedRegions = [];

        templateRegions.forEach((template, templateIndex) => {
            console.log(`Processing template region ${templateIndex + 1}: ${template.type}`);

            const typeConfig = regionTypeConfig[template.type] || {};

            // Find text regions that overlap or are near this template region
            const relevantText = textRegions.filter(text => {
                const overlap = this.regionsOverlap(template, text);
                const distance = this.calculateDistance(template, text);
                const maxDistance = typeConfig.boundaryExpansion || 50;
                return overlap || distance < maxDistance;
            });

            console.log(`Found ${relevantText.length} relevant text regions for template ${template.type}`);

            if (relevantText.length > 0) {
                // Adjust template boundaries based on configuration and text
                const adjustedRegion = this.adjustRegionBoundariesWithConfig(
                    template,
                    relevantText,
                    typeConfig,
                    templateAdherence,
                    canvasWidth,
                    canvasHeight
                );

                adjustedRegion.confidence = this.calculateConfidenceWithConfig(
                    adjustedRegion,
                    relevantText,
                    typeConfig,
                    'template_refined'
                );
                adjustedRegion.source = 'template_refined';
                adjustedRegion.originalTemplate = template;

                // Apply region-specific constraints
                if (this.validateRegionConstraints(adjustedRegion, typeConfig, canvasWidth, canvasHeight)) {
                    refinedRegions.push(adjustedRegion);
                }
            } else {
                // No text found - decide based on template adherence
                if (templateAdherence > 0.5) {
                    // High adherence - keep template region
                    const originalRegion = {...template};
                    originalRegion.confidence = Math.max(0.1, typeConfig.minConfidence || 0.2);
                    originalRegion.source = 'template_only';
                    originalRegion.originalTemplate = template;

                    if (this.validateRegionConstraints(originalRegion, typeConfig, canvasWidth, canvasHeight)) {
                        refinedRegions.push(originalRegion);
                    }
                }
            }
        });

        // Look for significant text regions not covered by any template (if template adherence is not too high)
        if (templateAdherence < 0.8) {
            const uncoveredText = textRegions.filter(text => {
                return !templateRegions.some(template =>
                    this.regionsOverlap(template, text) || this.calculateDistance(template, text) < 50
                );
            });

            if (uncoveredText.length > 0) {
                console.log(`Found ${uncoveredText.length} uncovered text regions`);
                const newRegions = this.createRegionsFromTextAreas(uncoveredText, canvasWidth, canvasHeight);
                newRegions.forEach(region => {
                    region.source = 'auto_detected_additional';
                    region.confidence = Math.max(0.3, region.confidence - 0.2);
                    refinedRegions.push(region);
                });
            }
        }

        return refinedRegions;
    },

    /**
     * Adjust region boundaries with configuration constraints
     */
    adjustRegionBoundariesWithConfig(template, textRegions, typeConfig, templateAdherence, canvasWidth, canvasHeight) {
        const expansion = typeConfig.boundaryExpansion || 10;
        const preferTemplate = typeConfig.preferTemplatePosition && templateAdherence > 0.5;

        let minX, minY, maxX, maxY;

        if (preferTemplate) {
            // Start with template bounds and expand minimally
            minX = template.x;
            minY = template.y;
            maxX = template.x + template.width;
            maxY = template.y + template.height;

            // Expand only to include text that's outside template
            textRegions.forEach(text => {
                if (text.minX < minX) minX = Math.max(0, text.minX - expansion);
                if (text.minY < minY) minY = Math.max(0, text.minY - expansion);
                if (text.maxX > maxX) maxX = Math.min(canvasWidth, text.maxX + expansion);
                if (text.maxY > maxY) maxY = Math.min(canvasHeight, text.maxY + expansion);
            });
        } else {
            // Text-based boundaries with template as reference
            minX = Math.min(template.x, ...textRegions.map(t => t.minX));
            minY = Math.min(template.y, ...textRegions.map(t => t.minY));
            maxX = Math.max(template.x + template.width, ...textRegions.map(t => t.maxX));
            maxY = Math.max(template.y + template.height, ...textRegions.map(t => t.maxY));

            // Apply expansion
            minX = Math.max(0, minX - expansion);
            minY = Math.max(0, minY - expansion);
            maxX = Math.min(canvasWidth, maxX + expansion);
            maxY = Math.min(canvasHeight, maxY + expansion);
        }

        // Apply size constraints
        const width = maxX - minX;
        const height = maxY - minY;

        // Ensure minimum size
        const minWidth = typeConfig.minWidth || 20;
        const minHeight = typeConfig.minHeight || 10;

        if (width < minWidth) {
            const center = (minX + maxX) / 2;
            minX = Math.max(0, center - minWidth / 2);
            maxX = Math.min(canvasWidth, center + minWidth / 2);
        }

        if (height < minHeight) {
            const center = (minY + maxY) / 2;
            minY = Math.max(0, center - minHeight / 2);
            maxY = Math.min(canvasHeight, center + minHeight / 2);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            type: template.type
        };
    },

    /**
     * Calculate confidence with configuration parameters
     */
    calculateConfidenceWithConfig(region, textRegions, typeConfig, source = 'unknown') {
        if (textRegions.length === 0) {
            return typeConfig.minConfidence || 0.2;
        }

        const regionArea = region.width * region.height;
        const textArea = textRegions.reduce((sum, text) => sum + (text.width * text.height), 0);
        const textPixels = textRegions.reduce((sum, text) => sum + text.pixelCount, 0);

        // Coverage and density calculations
        const coverage = Math.min(textArea / regionArea, 1);
        const density = textArea > 0 ? textPixels / textArea : 0;

        // Apply type-specific requirements
        const minDensity = typeConfig.requireTextDensity || 0.01;
        if (density < minDensity) {
            return typeConfig.minConfidence || 0.1;
        }

        // Size scoring
        const sizeScore = Math.min(1, Math.sqrt(regionArea) / 300);

        // Source-specific adjustments
        let sourceMultiplier = 1;
        switch (source) {
            case 'template_refined':
                sourceMultiplier = 1.2;
                break;
            case 'template_expanded':
                sourceMultiplier = 0.8;
                break;
            case 'auto_detected':
                sourceMultiplier = 1.0;
                break;
            default:
                sourceMultiplier = 0.9;
        }

        const baseConfidence = (coverage * 0.4 + density * 0.3 + sizeScore * 0.3) * sourceMultiplier;
        return Math.max(typeConfig.minConfidence || 0.1, Math.min(0.95, baseConfidence));
    },

    /**
     * Validate region against type-specific constraints
     */
    validateRegionConstraints(region, typeConfig, canvasWidth, canvasHeight) {
        // Width ratio constraints
        if (typeConfig.maxWidthRatio) {
            const maxWidth = canvasWidth * typeConfig.maxWidthRatio;
            if (region.width > maxWidth) return false;
        }

        if (typeConfig.minWidthRatio) {
            const minWidth = canvasWidth * typeConfig.minWidthRatio;
            if (region.width < minWidth) return false;
        }

        // Height ratio constraints
        if (typeConfig.maxHeightRatio) {
            const maxHeight = canvasHeight * typeConfig.maxHeightRatio;
            if (region.height > maxHeight) return false;
        }

        if (typeConfig.minHeightRatio) {
            const minHeight = canvasHeight * typeConfig.minHeightRatio;
            if (region.height < minHeight) return false;
        }

        return true;
    },

    /**
     * Apply region-specific confidence filtering
     */
    applyRegionSpecificFiltering(regions, regionTypeConfig, globalThreshold) {
        return regions.filter(region => {
            const typeConfig = regionTypeConfig[region.type] || {};
            const minConfidence = typeConfig.minConfidence || globalThreshold;
            return region.confidence >= minConfidence;
        });
    },

    /**
     * Prevent region overlaps with configurable tolerance
     */
    preventRegionOverlaps(regions, tolerance = 5) {
        const nonOverlappingRegions = [];

        // Sort by confidence (highest first)
        const sortedRegions = [...regions].sort((a, b) => b.confidence - a.confidence);

        sortedRegions.forEach(region => {
            // Check if this region overlaps with any already accepted region
            const hasOverlap = nonOverlappingRegions.some(existing => {
                const overlapArea = this.calculateOverlapArea(region, existing);
                return overlapArea > tolerance;
            });

            if (!hasOverlap) {
                nonOverlappingRegions.push(region);
            } else {
                console.log(`Rejecting overlapping region: ${region.type} (confidence: ${region.confidence})`);
            }
        });

        return nonOverlappingRegions;
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

        for (let y = 0; y < height; y += 5) { // Skip pixels for performance
            for (let x = 0; x < width; x += 5) {
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
                            pixelCount: region.pixels.length,
                            density: region.pixels.length / ((region.maxX - region.minX) * (region.maxY - region.minY))
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

            // Add 8-connected neighbors for better text detection
            stack.push(
                {x: x + 1, y}, {x: x - 1, y}, {x, y: y + 1}, {x, y: y - 1},
                {x: x + 1, y: y + 1}, {x: x - 1, y: y - 1}, {x: x + 1, y: y - 1}, {x: x - 1, y: y + 1}
            );
        }

        return {pixels, minX, minY, maxX, maxY};
    },

    /**
     * Enhanced template region refinement
     */
    refineTemplateRegions(templateRegions, textRegions, canvasWidth, canvasHeight) {
        const refinedRegions = [];

        templateRegions.forEach((template, templateIndex) => {
            console.log(`Processing template region ${templateIndex + 1}: ${template.type}`);

            // Find text regions that overlap or are near this template region
            const relevantText = textRegions.filter(text => {
                const overlap = this.regionsOverlap(template, text);
                const distance = this.calculateDistance(template, text);
                return overlap || distance < 100; // Include nearby text
            });

            console.log(`Found ${relevantText.length} relevant text regions for template ${template.type}`);

            if (relevantText.length > 0) {
                // Adjust template boundaries based on actual text
                const adjustedRegion = this.adjustRegionBoundaries(template, relevantText);
                adjustedRegion.confidence = this.calculateConfidence(adjustedRegion, relevantText, 'template_refined');
                adjustedRegion.source = 'template_refined';
                adjustedRegion.originalTemplate = template;
                refinedRegions.push(adjustedRegion);
            } else {
                // No text found in template area - check if we should suggest expanding the search
                const expandedTemplate = this.expandTemplateRegion(template, 50); // Expand by 50px
                const expandedText = textRegions.filter(text => this.regionsOverlap(expandedTemplate, text));

                if (expandedText.length > 0) {
                    const adjustedRegion = this.adjustRegionBoundaries(template, expandedText);
                    adjustedRegion.confidence = 0.4; // Lower confidence for expanded regions
                    adjustedRegion.source = 'template_expanded';
                    adjustedRegion.originalTemplate = template;
                    refinedRegions.push(adjustedRegion);
                } else {
                    // Keep original template but mark as low confidence
                    const originalRegion = {...template};
                    originalRegion.confidence = 0.2;
                    originalRegion.source = 'template_only';
                    originalRegion.originalTemplate = template;
                    refinedRegions.push(originalRegion);
                }
            }
        });

        // Look for significant text regions not covered by any template
        const uncoveredText = textRegions.filter(text => {
            return !templateRegions.some(template =>
                this.regionsOverlap(template, text) || this.calculateDistance(template, text) < 50
            );
        });

        if (uncoveredText.length > 0) {
            console.log(`Found ${uncoveredText.length} uncovered text regions`);
            const newRegions = this.createRegionsFromTextAreas(uncoveredText, canvasWidth, canvasHeight);
            newRegions.forEach(region => {
                region.source = 'auto_detected_additional';
                region.confidence = Math.max(0.3, region.confidence - 0.2); // Lower confidence
                refinedRegions.push(region);
            });
        }

        return refinedRegions;
    },

    /**
     * Expand a template region by a given margin
     */
    expandTemplateRegion(template, margin) {
        return {
            x: Math.max(0, template.x - margin),
            y: Math.max(0, template.y - margin),
            width: template.width + (2 * margin),
            height: template.height + (2 * margin),
            type: template.type
        };
    },

    /**
     * Create new regions from detected text areas
     */
    createRegionsFromTextAreas(textRegions, canvasWidth, canvasHeight) {
        // Group nearby text regions into larger areas
        const groupedRegions = this.groupNearbyRegions(textRegions);

        return groupedRegions.map((group, index) => ({
            x: Math.max(0, group.minX - 5), // Small padding
            y: Math.max(0, group.minY - 5),
            width: Math.min(canvasWidth, group.width + 10),
            height: Math.min(canvasHeight, group.height + 10),
            type: this.guessRegionType(group, canvasWidth, canvasHeight),
            confidence: this.calculateTextGroupConfidence(group),
            source: 'auto_detected',
            textRegions: group.regions
        }));
    },

    /**
     * Group nearby text regions together with improved logic
     */
    groupNearbyRegions(textRegions, maxDistance = 80) {
        const groups = [];
        const used = new Array(textRegions.length).fill(false);

        // Sort by size (larger regions first)
        const sortedRegions = textRegions
            .map((region, index) => ({...region, originalIndex: index}))
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));

        sortedRegions.forEach((region) => {
            const originalIndex = region.originalIndex;
            if (used[originalIndex]) return;

            const group = {
                minX: region.minX,
                minY: region.minY,
                maxX: region.maxX,
                maxY: region.maxY,
                regions: [region]
            };

            // Find nearby regions to group together
            sortedRegions.forEach((other) => {
                const otherIndex = other.originalIndex;
                if (originalIndex === otherIndex || used[otherIndex]) return;

                const distance = this.calculateDistance(region, other);
                const verticalAlignment = Math.abs(region.minY - other.minY) < 20; // Similar Y position
                const horizontalAlignment = Math.abs(region.minX - other.minX) < 20; // Similar X position

                if (distance < maxDistance || verticalAlignment || horizontalAlignment) {
                    used[otherIndex] = true;
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
            used[originalIndex] = true;
        });

        return groups;
    },

    /**
     * Improved region type guessing
     */
    guessRegionType(region, canvasWidth, canvasHeight) {
        const centerX = region.minX + region.width / 2;
        const centerY = region.minY + region.height / 2;
        const aspectRatio = region.width / region.height;

        // Header detection (top 20% of image, wide aspect ratio)
        if (centerY < canvasHeight * 0.2 && aspectRatio > 2) {
            return 'header';
        }

        // Footer detection (bottom 20% of image, wide aspect ratio)
        if (centerY > canvasHeight * 0.8 && aspectRatio > 2) {
            return 'footer';
        }

        // Margin detection based on position and size
        const isNarrow = region.width < canvasWidth * 0.3;
        const isTall = region.height > canvasHeight * 0.3;

        if (isNarrow && isTall) {
            if (centerX < canvasWidth * 0.3) {
                return 'left-margin';
            } else if (centerX > canvasWidth * 0.7) {
                return 'right-margin';
            }
        }

        // Main text areas
        if (centerX < canvasWidth * 0.5) {
            return 'left-text';
        } else {
            return 'right-text';
        }
    },

    /**
     * Calculate confidence for grouped text regions
     */
    calculateTextGroupConfidence(group) {
        const totalPixels = group.regions.reduce((sum, region) => sum + region.pixelCount, 0);
        const groupArea = group.width * group.height;
        const density = totalPixels / groupArea;

        // Higher confidence for denser text regions
        const densityScore = Math.min(1, density * 10);

        // Higher confidence for larger regions
        const sizeScore = Math.min(1, Math.sqrt(groupArea) / 200);

        // Bonus for multiple text regions in group
        const groupScore = Math.min(1, group.regions.length / 5);

        return Math.max(0.1, Math.min(0.9, (densityScore + sizeScore + groupScore) / 3));
    },

    /**
     * Check if two regions overlap
     */
    regionsOverlap(region1, region2) {
        const r1 = {
            left: region1.x || region1.minX,
            right: (region1.x || region1.minX) + (region1.width || (region1.maxX - region1.minX)),
            top: region1.y || region1.minY,
            bottom: (region1.y || region1.minY) + (region1.height || (region1.maxY - region1.minY))
        };

        const r2 = {
            left: region2.x || region2.minX,
            right: (region2.x || region2.minX) + (region2.width || (region2.maxX - region2.minX)),
            top: region2.y || region2.minY,
            bottom: (region2.y || region2.minY) + (region2.height || (region2.maxY - region2.minY))
        };

        return !(r1.right < r2.left || r2.right < r1.left || r1.bottom < r2.top || r2.bottom < r1.top);
    },

    /**
     * Adjust region boundaries based on detected text
     */
    adjustRegionBoundaries(template, textRegions) {
        let minX = template.x;
        let minY = template.y;
        let maxX = template.x + template.width;
        let maxY = template.y + template.height;

        // Expand to include all overlapping text with smart padding
        textRegions.forEach(text => {
            const padding = Math.min(10, text.width * 0.1); // Adaptive padding
            minX = Math.min(minX, text.minX - padding);
            minY = Math.min(minY, text.minY - padding);
            maxX = Math.max(maxX, text.maxX + padding);
            maxY = Math.max(maxY, text.maxY + padding);
        });

        // Ensure minimum size
        const minWidth = 50;
        const minHeight = 20;
        if (maxX - minX < minWidth) {
            const center = (minX + maxX) / 2;
            minX = center - minWidth / 2;
            maxX = center + minWidth / 2;
        }
        if (maxY - minY < minHeight) {
            const center = (minY + maxY) / 2;
            minY = center - minHeight / 2;
            maxY = center + minHeight / 2;
        }

        return {
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: maxX - minX,
            height: maxY - minY,
            type: template.type || 'unknown'
        };
    },

    /**
     * Enhanced confidence calculation
     */
    calculateConfidence(region, textRegions, source = 'unknown') {
        if (textRegions.length === 0) {
            return source === 'template_only' ? 0.2 : 0.1;
        }

        const regionArea = region.width * region.height;
        const textArea = textRegions.reduce((sum, text) => sum + (text.width * text.height), 0);
        const textPixels = textRegions.reduce((sum, text) => sum + text.pixelCount, 0);

        // Coverage: how much of the region contains text
        const coverage = Math.min(textArea / regionArea, 1);

        // Density: how dense the text is within text areas
        const density = textArea > 0 ? textPixels / textArea : 0;

        // Size bonus: prefer reasonably sized regions
        const sizeScore = Math.min(1, Math.sqrt(regionArea) / 300);

        // Source-specific adjustments
        let sourceMultiplier = 1;
        switch (source) {
            case 'template_refined':
                sourceMultiplier = 1.2; // Boost template-based regions
                break;
            case 'template_expanded':
                sourceMultiplier = 0.8;
                break;
            case 'auto_detected':
                sourceMultiplier = 1.0;
                break;
            default:
                sourceMultiplier = 0.9;
        }

        const baseConfidence = (coverage * 0.4 + density * 0.3 + sizeScore * 0.3) * sourceMultiplier;
        return Math.max(0.1, Math.min(0.95, baseConfidence));
    },

    /**
     * Calculate distance between two regions
     */
    calculateDistance(region1, region2) {
        const centerX1 = (region1.x || region1.minX) + ((region1.width || (region1.maxX - region1.minX)) / 2);
        const centerY1 = (region1.y || region1.minY) + ((region1.height || (region1.maxY - region1.minY)) / 2);
        const centerX2 = (region2.x || region2.minX) + ((region2.width || (region2.maxX - region2.minX)) / 2);
        const centerY2 = (region2.y || region2.minY) + ((region2.height || (region2.maxY - region2.minY)) / 2);

        return Math.sqrt((centerX1 - centerX2) ** 2 + (centerY1 - centerY2) ** 2);
    },

    /**
     * Score and cleanup regions with improved filtering
     */
    scoreAndCleanupRegions(regions, textRegions, confidenceThreshold) {
        // Remove duplicate or overlapping regions
        const cleanedRegions = this.removeDuplicateRegions(regions);

        // Filter by confidence and sort
        return cleanedRegions
            .filter(region => region.confidence >= confidenceThreshold)
            .sort((a, b) => {
                // Sort by confidence, then by source preference
                if (Math.abs(a.confidence - b.confidence) < 0.1) {
                    const sourceOrder = ['template_refined', 'template_expanded', 'auto_detected', 'template_only'];
                    return sourceOrder.indexOf(a.source) - sourceOrder.indexOf(b.source);
                }
                return b.confidence - a.confidence;
            })
            .slice(0, 25); // Limit to top 25 regions
    },

    /**
     * Remove duplicate or heavily overlapping regions
     */
    removeDuplicateRegions(regions) {
        const filtered = [];

        regions.forEach(region => {
            const isDuplicate = filtered.some(existing => {
                const overlapArea = this.calculateOverlapArea(region, existing);
                const regionArea = region.width * region.height;
                const existingArea = existing.width * existing.height;

                // Consider duplicate if more than 70% overlap
                const overlapRatio = overlapArea / Math.min(regionArea, existingArea);
                return overlapRatio > 0.7;
            });

            if (!isDuplicate) {
                filtered.push(region);
            }
        });

        return filtered;
    },

    /**
     * Calculate overlap area between two regions
     */
    calculateOverlapArea(region1, region2) {
        const left = Math.max(region1.x, region2.x);
        const right = Math.min(region1.x + region1.width, region2.x + region2.width);
        const top = Math.max(region1.y, region2.y);
        const bottom = Math.min(region1.y + region1.height, region2.y + region2.height);

        if (left < right && top < bottom) {
            return (right - left) * (bottom - top);
        }
        return 0;
    }
};