/**
 * CanvasManager - Handles canvas drawing and region interaction
 */

window.CanvasManager = {
    // Canvas and drawing state
    canvas: null,
    ctx: null,
    image: null,
    scale: 1,
    showGrid: false,
    skewAngle: 0,

    // Region interaction state
    regions: [],
    currentRegion: null,
    selectedRegion: null,
    isDrawing: false,
    resizing: null,
    resizeHandleSize: 8,

    // Colors for different region types
    regionColors: {},

    /**
     * Initialize the canvas manager
     */
    init() {
        this.regionColors = Utils.REGION_COLORS;
        this.canvas = document.getElementById('canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.setupCanvasEvents();
        }
    },

    /**
     * Setup canvas event listeners
     */
    setupCanvasEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
    },

    /**
     * Setup canvas dimensions based on image
     */
    setupCanvas() {
        if (!this.image) return;

        // Scale image to fit screen while maintaining aspect ratio
        const maxWidth = 1000;
        const maxHeight = 800;
        const scale = Math.min(maxWidth / this.image.width, maxHeight / this.image.height, 1);

        this.canvas.width = this.image.width * scale;
        this.canvas.height = this.image.height * scale;
        this.scale = scale;
    },

    /**
     * Set the current image
     */
    setImage(image) {
        this.image = image;
        this.setupCanvas();
        this.redraw();
    },

    /**
     * Redraw the entire canvas
     */
    redraw() {
        if (!this.image) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply skew transformation ONLY to the image
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(this.skewAngle * Math.PI / 180);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        // Draw image (rotated)
        this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);

        this.ctx.restore(); // Reset transformation

        // Draw grid AFTER restore so it stays straight
        if (this.showGrid) {
            this.drawGrid();
        }

        // Draw regions (also straight, not rotated)
        this.regions.forEach((region, index) => {
            this.drawRegion(region, index === this.selectedRegion);
        });

        // Draw current region being drawn
        if (this.currentRegion) {
            this.drawRegion(this.currentRegion, false, true);
        }
    },

    /**
     * Draw grid overlay for alignment
     */
    drawGrid() {
        const gridSpacing = 50; // pixels

        // Make grid lines visible
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; // Red for visibility
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([3, 3]);

        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Center lines (more prominent)
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)'; // Green center lines
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);

        // Vertical center line
        const centerX = this.canvas.width / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();

        // Horizontal center line
        const centerY = this.canvas.height / 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    },

    /**
     * Draw a region with optional selection state
     */
    drawRegion(region, isSelected = false, isTemp = false) {
        const color = this.regionColors[region.type] || this.regionColors['custom'];

        // Fill
        this.ctx.fillStyle = color;
        this.ctx.fillRect(region.x, region.y, region.width, region.height);

        // Border
        this.ctx.strokeStyle = isSelected ? '#007acc' : (isTemp ? '#666' : '#333');
        this.ctx.lineWidth = isSelected ? 3 : (isTemp ? 2 : 1);
        this.ctx.setLineDash(isTemp ? [5, 5] : []);
        this.ctx.strokeRect(region.x, region.y, region.width, region.height);

        // Label
        if (!isTemp) {
            this.ctx.fillStyle = '#333';
            this.ctx.font = '12px sans-serif';
            this.ctx.fillText(region.type, region.x + 4, region.y + 16);
        }

        // Draw resize handles for selected region
        if (isSelected && !isTemp) {
            this.drawResizeHandles(region);
        }

        this.ctx.setLineDash([]);
    },

    /**
     * Draw resize handles around a region
     */
    drawResizeHandles(region) {
        const handles = this.getResizeHandles(region);
        this.ctx.fillStyle = '#007acc';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;

        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, this.resizeHandleSize, this.resizeHandleSize);
            this.ctx.strokeRect(handle.x, handle.y, this.resizeHandleSize, this.resizeHandleSize);
        });
    },

    /**
     * Get resize handle positions for a region
     */
    getResizeHandles(region) {
        const hs = this.resizeHandleSize;
        const hs2 = hs / 2;
        return [
            { x: region.x - hs2, y: region.y - hs2, type: 'nw' },
            { x: region.x + region.width/2 - hs2, y: region.y - hs2, type: 'n' },
            { x: region.x + region.width - hs2, y: region.y - hs2, type: 'ne' },
            { x: region.x - hs2, y: region.y + region.height/2 - hs2, type: 'w' },
            { x: region.x + region.width - hs2, y: region.y + region.height/2 - hs2, type: 'e' },
            { x: region.x - hs2, y: region.y + region.height - hs2, type: 'sw' },
            { x: region.x + region.width/2 - hs2, y: region.y + region.height - hs2, type: 's' },
            { x: region.x + region.width - hs2, y: region.y + region.height - hs2, type: 'se' }
        ];
    },

    /**
     * Start drawing or resizing
     */
    startDrawing(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on a resize handle first
        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];
            if (i === this.selectedRegion) {
                const handles = this.getResizeHandles(region);
                for (let handle of handles) {
                    if (Utils.pointInRect(x, y, {
                        x: handle.x,
                        y: handle.y,
                        width: this.resizeHandleSize,
                        height: this.resizeHandleSize
                    })) {
                        this.resizing = { regionIndex: i, handle: handle.type, startX: x, startY: y };
                        return;
                    }
                }
            }
        }

        // Check if clicking inside an existing region
        for (let i = this.regions.length - 1; i >= 0; i--) {
            const region = this.regions[i];
            if (Utils.pointInRect(x, y, region)) {
                this.selectedRegion = i;
                if (window.editor && window.editor.updateRegionList) {
                    window.editor.updateRegionList();
                }
                this.redraw();
                return;
            }
        }

        // Start drawing new region
        this.selectedRegion = null;
        this.isDrawing = true;

        let regionType = document.getElementById('regionType').value;
        if (regionType === 'custom') {
            regionType = prompt('Enter custom region type:') || 'custom';
            if (regionType !== 'custom' && window.editor && window.editor.customTypes) {
                if (!window.editor.customTypes.includes(regionType)) {
                    window.editor.customTypes.push(regionType);
                    if (window.editor.updateRegionTypeSelect) {
                        window.editor.updateRegionTypeSelect();
                    }
                }
            }
        }

        this.currentRegion = {
            x: x,
            y: y,
            width: 0,
            height: 0,
            type: regionType
        };
    },

    /**
     * Handle mouse movement during drawing/resizing
     */
    draw(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.resizing) {
            // Handle region resizing
            const region = this.regions[this.resizing.regionIndex];
            const handle = this.resizing.handle;

            const originalX = region.x;
            const originalY = region.y;
            const originalWidth = region.width;
            const originalHeight = region.height;

            switch (handle) {
                case 'nw':
                    region.x = x;
                    region.y = y;
                    region.width = originalX + originalWidth - x;
                    region.height = originalY + originalHeight - y;
                    break;
                case 'n':
                    region.y = y;
                    region.height = originalY + originalHeight - y;
                    break;
                case 'ne':
                    region.y = y;
                    region.width = x - region.x;
                    region.height = originalY + originalHeight - y;
                    break;
                case 'w':
                    region.x = x;
                    region.width = originalX + originalWidth - x;
                    break;
                case 'e':
                    region.width = x - region.x;
                    break;
                case 'sw':
                    region.x = x;
                    region.width = originalX + originalWidth - x;
                    region.height = y - region.y;
                    break;
                case 's':
                    region.height = y - region.y;
                    break;
                case 'se':
                    region.width = x - region.x;
                    region.height = y - region.y;
                    break;
            }

            if (window.editor && window.editor.updateRegionList) {
                window.editor.updateRegionList();
            }
            this.redraw();
            return;
        }

        if (!this.isDrawing) return;

        this.currentRegion.width = x - this.currentRegion.x;
        this.currentRegion.height = y - this.currentRegion.y;

        this.redraw();
    },

    /**
     * Stop drawing or resizing
     */
    stopDrawing(e) {
        if (this.resizing) {
            this.resizing = null;
            return;
        }

        if (!this.isDrawing) return;

        this.isDrawing = false;

        // Only add region if it has meaningful size
        if (Math.abs(this.currentRegion.width) > 10 && Math.abs(this.currentRegion.height) > 10) {
            // Normalize negative dimensions
            this.currentRegion = ImageProcessor.normalizeRegion(this.currentRegion);

            this.regions.push({...this.currentRegion});
            this.selectedRegion = this.regions.length - 1; // Auto-select new region

            if (window.editor) {
                if (window.editor.updateRegionList) {
                    window.editor.updateRegionList();
                }
                if (window.editor.updateStatus) {
                    window.editor.updateStatus(`Added ${this.currentRegion.type} region`);
                }
            }
        }

        this.currentRegion = null;
        this.redraw();
    },

    /**
     * Set skew angle and redraw
     */
    setSkew(angle) {
        this.skewAngle = angle;
        this.redraw();
    },

    /**
     * Toggle grid display
     */
    toggleGrid(show) {
        this.showGrid = show;
        this.redraw();
    },

    /**
     * Clear all regions
     */
    clearRegions() {
        this.regions = [];
        this.selectedRegion = null;
        this.redraw();
    },

    /**
     * Select a region by index
     */
    selectRegion(index) {
        this.selectedRegion = index;
        this.redraw();
    },

    /**
     * Delete a region by index
     */
    deleteRegion(index) {
        this.regions.splice(index, 1);
        if (this.selectedRegion === index) {
            this.selectedRegion = null;
        }
        this.redraw();
    },

    /**
     * Get all regions
     */
    getRegions() {
        return this.regions;
    },

    /**
     * Set regions (for loading templates)
     */
    setRegions(regions) {
        this.regions = regions;
        this.selectedRegion = null;
        this.redraw();
    },

    /**
     * Add color for custom region type
     */
    addRegionColor(type, color) {
        this.regionColors[type] = color;
    }
};