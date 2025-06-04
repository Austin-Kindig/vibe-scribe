/**
 * RegionEditorCore - Main editor class with enhanced auto-detection
 */

class RegionEditor {
    constructor() {
        // PDF handling
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.pageRegions = {}; // Store regions for each page
        this.customTypes = []; // Store user-defined region types

        // Template management
        this.savedTemplates = this.loadSavedTemplates();
        this.currentTemplate = null;

        // Current document info for processing
        this.currentPdfFile = null;
        this.currentFilename = null;
        this.originalPdfPages = []; // Store original PDF page images

        this.init();
    }

    init() {
        PDFHandler.init();
        QualityReview.init();
        CanvasManager.init();
        this.setupEventListeners();
        this.updateTemplateDropdown();
        this.updateStatus('Load a PDF or image to start drawing regions');
    }

    setupEventListeners() {
        // Tab switching
        Utils.addSafeEventListener('editorTab', 'click', () => this.switchTab('editor'));
        Utils.addSafeEventListener('processingTab', 'click', () => this.switchTab('processing'));
        Utils.addSafeEventListener('reviewTab', 'click', () => this.switchTab('review'));

        // File input
        Utils.addSafeEventListener('fileInput', 'change', (e) => {
            this.loadFile(e.target.files[0]);
        });

        // Page navigation
        Utils.addSafeEventListener('prevPage', 'click', () => this.previousPage());
        Utils.addSafeEventListener('nextPage', 'click', () => this.nextPage());

        // Toolbar buttons
        Utils.addSafeEventListener('clearRegions', 'click', () => this.clearRegions());
        Utils.addSafeEventListener('addCustomType', 'click', () => this.addCustomType());
        Utils.addSafeEventListener('autoDetectRegions', 'click', () => this.autoDetectRegions());
        Utils.addSafeEventListener('exportRegions', 'click', () => this.exportRegions());
        Utils.addSafeEventListener('saveTemplate', 'click', () => this.saveTemplate());
        Utils.addSafeEventListener('loadTemplate', 'click', () => this.loadTemplate());

        // Template management
        Utils.addSafeEventListener('templateSelect', 'change', (e) => this.selectTemplate(e.target.value));
        Utils.addSafeEventListener('deleteTemplate', 'click', () => this.deleteCurrentTemplate());

        // Skew controls
        Utils.addSafeEventListener('skewSlider', 'input', (e) => this.updateSkew(e.target.value));
        Utils.addSafeEventListener('resetSkew', 'click', () => this.resetSkew());

        // Grid controls
        Utils.addSafeEventListener('showGrid', 'change', (e) => {
            CanvasManager.toggleGrid(e.target.checked);
        });

        // Processing tab controls
        Utils.addSafeEventListener('processCurrentDoc', 'click', () => this.processCurrentDocument());
    }

    /**
     * Load saved templates from localStorage
     */
    loadSavedTemplates() {
        const templates = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ocr_template_')) {
                const templateName = key.replace('ocr_template_', '');
                try {
                    templates[templateName] = JSON.parse(localStorage.getItem(key));
                } catch (error) {
                    console.warn(`Failed to load template ${templateName}:`, error);
                }
            }
        }
        return templates;
    }

    /**
     * Update template dropdown
     */
    updateTemplateDropdown() {
        let selectEl = document.getElementById('templateSelect');
        if (!selectEl) {
            // Create template controls if they don't exist
            this.createTemplateControls();
            selectEl = document.getElementById('templateSelect');
        }

        if (!selectEl) return;

        const currentValue = selectEl.value;
        selectEl.innerHTML = '<option value="">Choose a template...</option>';

        Object.keys(this.savedTemplates).forEach(templateName => {
            const option = document.createElement('option');
            option.value = templateName;
            option.textContent = templateName;
            selectEl.appendChild(option);
        });

        // Restore selection if template still exists
        if (currentValue && this.savedTemplates[currentValue]) {
            selectEl.value = currentValue;
        }
    }

    /**
     * Create template controls in the sidebar
     */
    createTemplateControls() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;

        const existingTemplateSection = document.getElementById('templateSection');
        if (existingTemplateSection) {
            existingTemplateSection.remove();
        }

        const templateSection = document.createElement('div');
        templateSection.id = 'templateSection';
        templateSection.style.marginTop = '30px';

        templateSection.innerHTML = `
            <h4>Templates</h4>
            <div style="margin-bottom: 10px;">
                <select id="templateSelect" style="width: 100%; margin-bottom: 8px;">
                    <option value="">Choose a template...</option>
                </select>
            </div>
            <div style="display: flex; gap: 5px; margin-bottom: 8px;">
                <button class="btn" id="saveTemplate" style="flex: 1;">Save</button>
                <button class="btn" id="loadTemplate" style="flex: 1;">Load</button>
                <button class="btn btn-danger" id="deleteTemplate" style="flex: 1; font-size: 11px;">Delete</button>
            </div>
            <div class="help-text">
                Templates store region layouts and can guide auto-detection for similar pages. The Auto-Detect button will use the selected template or current regions as guidance.
            </div>
        `;

        sidebar.appendChild(templateSection);

        // Re-setup event listeners for the new elements
        Utils.addSafeEventListener('templateSelect', 'change', (e) => this.selectTemplate(e.target.value));
        Utils.addSafeEventListener('saveTemplate', 'click', () => this.saveTemplate());
        Utils.addSafeEventListener('loadTemplate', 'click', () => this.loadTemplate());
        Utils.addSafeEventListener('deleteTemplate', 'click', () => this.deleteCurrentTemplate());
    }

    /**
     * Select a template from dropdown
     */
    selectTemplate(templateName) {
        if (templateName && this.savedTemplates[templateName]) {
            this.currentTemplate = this.savedTemplates[templateName];
            this.updateStatus(`Selected template: ${templateName}`);
        } else {
            this.currentTemplate = null;
        }
    }

    /**
     * Delete current template
     */
    deleteCurrentTemplate() {
        const selectEl = document.getElementById('templateSelect');
        const templateName = selectEl ? selectEl.value : null;

        if (!templateName) {
            this.updateStatus('No template selected');
            return;
        }

        if (confirm(`Delete template "${templateName}"? This cannot be undone.`)) {
            localStorage.removeItem('ocr_template_' + templateName);
            delete this.savedTemplates[templateName];
            this.currentTemplate = null;
            this.updateTemplateDropdown();
            this.updateStatus(`Template "${templateName}" deleted`);
        }
    }

    async loadFile(file) {
        if (!file) return;

        console.log('loadFile called with:', file.name, file.type);

        // Store current file info for processing
        this.currentPdfFile = file;
        this.currentFilename = file.name;
        this.updateCurrentDocInfo();

        // Initialize DetectionConfig when first file is loaded
        console.log('Checking DetectionConfig initialization...');
        console.log('DetectionConfig available:', typeof DetectionConfig !== 'undefined');
        console.log('DetectionConfig already initialized:', DetectionConfig && DetectionConfig.initialized);

        if (window.DetectionConfig && !window.DetectionConfig.initialized) {
            console.log('Initializing DetectionConfig after file load');
            try {
                DetectionConfig.init();
                DetectionConfig.initialized = true;
                console.log('DetectionConfig initialization successful');
            } catch (error) {
                console.error('DetectionConfig initialization failed:', error);
            }
        } else if (!window.DetectionConfig) {
            console.error('DetectionConfig not available!');
        } else {
            console.log('DetectionConfig already initialized, skipping');
        }

        if (file.type === 'application/pdf') {
            await this.loadPDF(file);
        } else {
            this.loadImage(file);
        }
    }

    async loadPDF(file) {
        try {
            this.updateStatus('Loading PDF...');

            const pdfData = await PDFHandler.loadPDF(file);
            this.pdfDoc = pdfData.document;
            this.totalPages = pdfData.totalPages;
            this.currentPage = 1;
            this.pageRegions = {};

            // Initialize originalPdfPages array
            this.originalPdfPages = new Array(this.totalPages);

            // Show page controls
            Utils.toggleElement('pageControls', true);
            this.updatePageInfo();

            await this.renderPage(this.currentPage);
            this.updateStatus(`PDF loaded: ${this.totalPages} pages`);
        } catch (error) {
            console.error('Error loading PDF:', error);
            this.updateStatus('Error loading PDF: ' + error.message);
        }
    }

    async renderPage(pageNum) {
        if (!this.pdfDoc) return;

        try {
            const pageData = await PDFHandler.renderPage(this.pdfDoc, pageNum);

            // Store original page data for processing
            this.originalPdfPages[pageNum - 1] = pageData;

            // Create image for display
            const img = await PDFHandler.createImageFromDataUrl(pageData.dataUrl);
            CanvasManager.setImage(img);
            this.loadPageRegions();

        } catch (error) {
            console.error('Error rendering page:', error);
            this.updateStatus('Error rendering page: ' + error.message);
        }
    }

    loadImage(file) {
        // Hide page controls for single images
        Utils.toggleElement('pageControls', false);
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.originalPdfPages = []; // Reset for single images

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                CanvasManager.setImage(img);
                this.updateStatus(`Image loaded: ${img.width}x${img.height}px`);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    savePageRegions() {
        if (this.pdfDoc) {
            this.pageRegions[this.currentPage] = [...CanvasManager.getRegions()];
        }
    }

    loadPageRegions() {
        if (this.pdfDoc && this.pageRegions[this.currentPage]) {
            CanvasManager.setRegions([...this.pageRegions[this.currentPage]]);
        } else {
            CanvasManager.setRegions([]);
        }
        this.updateRegionList();
    }

    updatePageInfo() {
        Utils.updateText('pageInfo', `Page ${this.currentPage} of ${this.totalPages}`);

        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;
    }

    async previousPage() {
        if (this.currentPage > 1) {
            this.savePageRegions();
            this.currentPage--;
            this.updatePageInfo();
            await this.renderPage(this.currentPage);
        }
    }

    async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.savePageRegions();
            this.currentPage++;
            this.updatePageInfo();
            await this.renderPage(this.currentPage);
        }
    }

    updateRegionList() {
        const list = document.getElementById('regionList');
        if (!list) return;

        list.innerHTML = '';
        const regions = CanvasManager.getRegions();

        regions.forEach((region, index) => {
            const item = document.createElement('div');
            item.className = 'region-item';
            if (index === CanvasManager.selectedRegion) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <div class="region-type">${region.type}</div>
                <div class="region-coords">
                    ${Math.round(region.x)}, ${Math.round(region.y)} 
                    (${Math.round(region.width)}×${Math.round(region.height)})
                </div>
                <div class="region-actions">
                    <button class="btn-small" onclick="editor.selectRegion(${index})">Select</button>
                    <button class="btn-small btn-danger" onclick="editor.deleteRegion(${index})">Delete</button>
                </div>
            `;

            list.appendChild(item);
        });
    }

    selectRegion(index) {
        CanvasManager.selectRegion(index);
        this.updateRegionList();
    }

    deleteRegion(index) {
        CanvasManager.deleteRegion(index);
        this.updateRegionList();
        this.updateStatus('Region deleted');
    }

    clearRegions() {
        CanvasManager.clearRegions();
        this.updateRegionList();
        this.updateStatus('All regions cleared');
    }

    updateSkew(value) {
        const angle = parseFloat(value);
        CanvasManager.setSkew(angle);
        Utils.updateText('skewValue', angle + '°');
    }

    resetSkew() {
        CanvasManager.setSkew(0);
        const slider = document.getElementById('skewSlider');
        if (slider) slider.value = 0;
        Utils.updateText('skewValue', '0°');
    }

    addCustomType() {
        const newType = prompt('Enter new region type name:');
        if (newType && !this.customTypes.includes(newType)) {
            this.customTypes.push(newType);
            const color = Utils.generateRandomColor();
            CanvasManager.addRegionColor(newType, color);
            this.updateRegionTypeSelect();
            this.updateStatus(`Added custom type: ${newType}`);
        }
    }

    /**
     * Enhanced auto-detect regions with comprehensive logging
     */
    async autoDetectRegions() {
        if (!CanvasManager.image) {
            this.updateStatus('No image loaded. Please load a document first.');
            return;
        }

        try {
            this.updateStatus('Auto-detecting regions...');

            // Create detection log
            const detectionLog = {
                timestamp: new Date().toISOString(),
                filename: this.currentFilename || 'unknown',
                currentPage: this.currentPage,
                imageInfo: {
                    width: CanvasManager.image.width,
                    height: CanvasManager.image.height,
                    displayScale: CanvasManager.scale
                },
                existingRegions: [],
                templateInfo: null,
                detectionSettings: {},
                detectionResults: {},
                textRegions: [],
                proposedRegions: []
            };

            // Log existing regions (what user has currently defined)
            const currentRegions = CanvasManager.getRegions();
            detectionLog.existingRegions = currentRegions.map(region => ({
                type: region.type,
                x: Math.round(region.x / CanvasManager.scale),
                y: Math.round(region.y / CanvasManager.scale),
                width: Math.round(region.width / CanvasManager.scale),
                height: Math.round(region.height / CanvasManager.scale),
                displayCoords: {
                    x: Math.round(region.x),
                    y: Math.round(region.y),
                    width: Math.round(region.width),
                    height: Math.round(region.height)
                }
            }));

            // Create a canvas with the current image for analysis
            const analysisCanvas = document.createElement('canvas');
            const analysisCtx = analysisCanvas.getContext('2d');
            analysisCanvas.width = CanvasManager.image.width;
            analysisCanvas.height = CanvasManager.image.height;
            analysisCtx.drawImage(CanvasManager.image, 0, 0);

            // Get template regions as guidance
            let templateRegions = [];

            // First priority: Current template selection
            if (this.currentTemplate && this.currentTemplate.regions) {
                templateRegions = this.currentTemplate.regions.map(region => ({
                    x: region.x / CanvasManager.scale,
                    y: region.y / CanvasManager.scale,
                    width: region.width / CanvasManager.scale,
                    height: region.height / CanvasManager.scale,
                    type: region.type
                }));
                detectionLog.templateInfo = {
                    source: 'selected_template',
                    name: this.currentTemplate.name || 'unknown',
                    regionCount: templateRegions.length,
                    regions: templateRegions.map(r => ({
                        type: r.type,
                        x: Math.round(r.x),
                        y: Math.round(r.y),
                        width: Math.round(r.width),
                        height: Math.round(r.height)
                    }))
                };
                this.updateStatus('Using selected template as guidance...');
            }
            // Second priority: Current page regions (if any)
            else {
                if (currentRegions.length > 0) {
                    templateRegions = currentRegions.map(region => ({
                        x: region.x / CanvasManager.scale,
                        y: region.y / CanvasManager.scale,
                        width: region.width / CanvasManager.scale,
                        height: region.height / CanvasManager.scale,
                        type: region.type
                    }));
                    detectionLog.templateInfo = {
                        source: 'current_regions',
                        regionCount: templateRegions.length,
                        regions: templateRegions.map(r => ({
                            type: r.type,
                            x: Math.round(r.x),
                            y: Math.round(r.y),
                            width: Math.round(r.width),
                            height: Math.round(r.height)
                        }))
                    };
                    this.updateStatus('Using current regions as template...');
                }
                // Third priority: Ask user to select a template
                else if (Object.keys(this.savedTemplates).length > 0) {
                    const templateName = await this.promptForTemplate();
                    if (templateName && this.savedTemplates[templateName]) {
                        templateRegions = this.savedTemplates[templateName].regions.map(region => ({
                            x: region.x / CanvasManager.scale,
                            y: region.y / CanvasManager.scale,
                            width: region.width / CanvasManager.scale,
                            height: region.height / CanvasManager.scale,
                            type: region.type
                        }));
                        detectionLog.templateInfo = {
                            source: 'user_selected_template',
                            name: templateName,
                            regionCount: templateRegions.length,
                            regions: templateRegions.map(r => ({
                                type: r.type,
                                x: Math.round(r.x),
                                y: Math.round(r.y),
                                width: Math.round(r.width),
                                height: Math.round(r.height)
                            }))
                        };
                        this.updateStatus(`Using template "${templateName}" as guidance...`);
                    } else {
                        detectionLog.templateInfo = { source: 'none', reason: 'user_cancelled' };
                    }
                } else {
                    detectionLog.templateInfo = { source: 'none', reason: 'no_templates_available' };
                }
            }

            // Log detection settings
            detectionLog.detectionSettings = {
                threshold: 128,
                minRegionSize: 200,
                confidenceThreshold: 0.5,
                useTemplateGuidance: templateRegions.length > 0,
                templateRegionCount: templateRegions.length
            };

            // Run auto-detection with template guidance and configuration
            const detectionOptions = {
                threshold: 128,
                minRegionSize: 200,
                confidenceThreshold: 0.5,
                useTemplateGuidance: templateRegions.length > 0,
                detectionLog: detectionLog // Pass log object to detector
            };

            // Get configuration if available
            if (window.DetectionConfig && window.DetectionConfig.currentConfig) {
                const config = window.DetectionConfig.currentConfig;
                Object.assign(detectionOptions, {
                    threshold: config.global.threshold,
                    minRegionSize: config.global.minRegionSize,
                    confidenceThreshold: config.global.confidenceThreshold,
                    preventOverlap: config.global.preventOverlap,
                    overlapTolerance: config.global.overlapTolerance,
                    templateAdherence: config.global.templateAdherence,
                    regionTypeConfig: config.regionTypes
                });
            }

            const result = await RegionDetector.autoDetectRegions(analysisCanvas, templateRegions, detectionOptions);

            // Log detection results
            detectionLog.detectionResults = {
                success: result.success,
                error: result.error || null,
                metadata: result.metadata || {},
                proposedRegionCount: result.regions ? result.regions.length : 0
            };

            if (result.success && result.regions) {
                // Convert detected regions back to canvas coordinates and log
                const detectedRegions = result.regions.map(region => ({
                    x: region.x * CanvasManager.scale,
                    y: region.y * CanvasManager.scale,
                    width: region.width * CanvasManager.scale,
                    height: region.height * CanvasManager.scale,
                    type: region.type,
                    confidence: region.confidence,
                    source: region.source
                }));

                detectionLog.proposedRegions = result.regions.map(region => ({
                    type: region.type,
                    x: Math.round(region.x),
                    y: Math.round(region.y),
                    width: Math.round(region.width),
                    height: Math.round(region.height),
                    confidence: Math.round(region.confidence * 100) / 100,
                    source: region.source,
                    displayCoords: {
                        x: Math.round(region.x * CanvasManager.scale),
                        y: Math.round(region.y * CanvasManager.scale),
                        width: Math.round(region.width * CanvasManager.scale),
                        height: Math.round(region.height * CanvasManager.scale)
                    }
                }));

                // Log the complete detection session
                this.logDetectionSession(detectionLog);

                if (detectedRegions.length > 0) {
                    // Show detection results and options
                    await this.showDetectionResults(detectedRegions, result.metadata);
                } else {
                    this.updateStatus('Auto-detection completed but no suitable regions found. Check console for detailed log.');
                }

            } else if (result.success && result.regions.length === 0) {
                detectionLog.detectionResults.reason = 'no_regions_found';
                this.logDetectionSession(detectionLog);
                this.updateStatus('Auto-detection completed but no suitable regions found. Try adjusting the image, creating a template, or using manual region drawing. Check console for detailed log.');
            } else {
                detectionLog.detectionResults.reason = result.error || 'unknown_error';
                this.logDetectionSession(detectionLog);
                this.updateStatus('Auto-detection failed: ' + (result.error || 'Unknown error') + '. Check console for detailed log.');
            }

        } catch (error) {
            console.error('Auto-detection error:', error);
            this.updateStatus('Auto-detection failed: ' + error.message + '. Check console for detailed log.');
        }
    }

    /**
     * Log comprehensive detection session data
     */
    logDetectionSession(detectionLog) {
        console.group(`🎯 Auto-Detection Session - ${detectionLog.timestamp}`);

        // Document info
        console.group("📄 Document Information");
        console.log("Filename:", detectionLog.filename);
        console.log("Current Page:", detectionLog.currentPage);
        console.log("Image Dimensions:", `${detectionLog.imageInfo.width}x${detectionLog.imageInfo.height}px`);
        console.log("Display Scale:", detectionLog.imageInfo.displayScale);
        console.groupEnd();

        // Existing regions (what user currently has)
        console.group("🎨 Current User-Defined Regions");
        if (detectionLog.existingRegions.length > 0) {
            console.log(`Count: ${detectionLog.existingRegions.length} regions`);
            console.table(detectionLog.existingRegions);
        } else {
            console.log("No existing regions defined");
        }
        console.groupEnd();

        // Template information
        console.group("📋 Template Information");
        if (detectionLog.templateInfo && detectionLog.templateInfo.source !== 'none') {
            console.log("Source:", detectionLog.templateInfo.source);
            if (detectionLog.templateInfo.name) {
                console.log("Template Name:", detectionLog.templateInfo.name);
            }
            console.log(`Region Count: ${detectionLog.templateInfo.regionCount}`);
            if (detectionLog.templateInfo.regions) {
                console.table(detectionLog.templateInfo.regions);
            }
        } else {
            console.log("No template used");
            if (detectionLog.templateInfo && detectionLog.templateInfo.reason) {
                console.log("Reason:", detectionLog.templateInfo.reason);
            }
        }
        console.groupEnd();

        // Detection settings
        console.group("⚙️ Detection Settings");
        console.table(detectionLog.detectionSettings);
        console.groupEnd();

        // Text regions found
        if (detectionLog.textRegions && detectionLog.textRegions.length > 0) {
            console.group("📝 Detected Text Regions");
            console.log(`Found ${detectionLog.textRegions.length} text regions`);
            console.table(detectionLog.textRegions);
            console.groupEnd();
        }

        // Proposed regions (what auto-detection suggests)
        console.group("🎯 Auto-Detection Results");
        console.log("Success:", detectionLog.detectionResults.success);
        if (detectionLog.detectionResults.error) {
            console.error("Error:", detectionLog.detectionResults.error);
        }
        if (detectionLog.detectionResults.metadata) {
            console.log("Metadata:", detectionLog.detectionResults.metadata);
        }
        if (detectionLog.proposedRegions.length > 0) {
            console.log(`Proposed ${detectionLog.proposedRegions.length} regions:`);
            console.table(detectionLog.proposedRegions);
        } else {
            console.log("No regions proposed");
            if (detectionLog.detectionResults.reason) {
                console.log("Reason:", detectionLog.detectionResults.reason);
            }
        }
        console.groupEnd();

        // Summary comparison
        console.group("📊 Summary Comparison");
        console.log("Current regions:", detectionLog.existingRegions.length);
        console.log("Template regions:", detectionLog.templateInfo ? (detectionLog.templateInfo.regionCount || 0) : 0);
        console.log("Proposed regions:", detectionLog.proposedRegions.length);

        if (detectionLog.existingRegions.length > 0 && detectionLog.proposedRegions.length > 0) {
            console.log("\n🔍 Region Type Comparison:");
            const currentTypes = detectionLog.existingRegions.map(r => r.type);
            const proposedTypes = detectionLog.proposedRegions.map(r => r.type);
            console.log("Current types:", [...new Set(currentTypes)]);
            console.log("Proposed types:", [...new Set(proposedTypes)]);
        }
        console.groupEnd();

        // Store in global for easy access
        window.lastDetectionLog = detectionLog;
        console.log("💾 Complete log stored in window.lastDetectionLog");

        console.groupEnd();
    }

    /**
     * Prompt user to select a template for auto-detection
     */
    async promptForTemplate() {
        return new Promise((resolve) => {
            const templateNames = Object.keys(this.savedTemplates);
            let message = 'No regions found on current page.\nSelect a template to guide auto-detection:\n\n';
            templateNames.forEach((name, index) => {
                message += `${index + 1}. ${name}\n`;
            });
            message += '\nEnter template number (or cancel):';

            const selection = prompt(message);
            if (selection && !isNaN(selection)) {
                const index = parseInt(selection) - 1;
                if (index >= 0 && index < templateNames.length) {
                    resolve(templateNames[index]);
                    return;
                }
            }
            resolve(null);
        });
    }

    /**
     * Show auto-detection results with options
     */
    async showDetectionResults(detectedRegions, metadata) {
        const currentRegions = CanvasManager.getRegions();

        let message = `🎯 Auto-Detection Results:\n\n`;
        message += `• Regions found: ${detectedRegions.length}\n`;
        message += `• Current regions: ${currentRegions.length}\n`;
        message += `• Template used: ${metadata.usedTemplate ? 'Yes' : 'No'}\n`;
        message += `• Text areas analyzed: ${metadata.textAreasFound}\n\n`;

        if (detectedRegions.length > 0) {
            message += `Detected regions:\n`;
            detectedRegions.forEach((region, index) => {
                message += `${index + 1}. ${region.type} (${Math.round(region.confidence * 100)}% confidence)\n`;
            });
            message += `\nChoose action:\n`;
            message += `1. Replace all current regions\n`;
            message += `2. Add to current regions\n`;
            message += `3. Preview only (no changes)\n`;
            message += `4. Cancel\n`;
        }

        const choice = prompt(message + '\nEnter choice (1-4):');

        switch (choice) {
            case '1':
                // Replace all regions
                CanvasManager.setRegions(detectedRegions);
                this.updateStatus(`Replaced regions with ${detectedRegions.length} auto-detected regions`);
                this.updateRegionList();
                break;
            case '2':
                // Add to existing regions
                const mergedRegions = [...currentRegions, ...detectedRegions];
                CanvasManager.setRegions(mergedRegions);
                this.updateStatus(`Added ${detectedRegions.length} auto-detected regions (total: ${mergedRegions.length})`);
                this.updateRegionList();
                break;
            case '3':
                // Preview mode - temporarily show detected regions
                this.previewDetectedRegions(detectedRegions, currentRegions);
                break;
            case '4':
            default:
                this.updateStatus('Auto-detection cancelled');
                break;
        }
    }

    /**
     * Preview detected regions temporarily
     */
    async previewDetectedRegions(detectedRegions, originalRegions) {
        // Show detected regions
        CanvasManager.setRegions(detectedRegions);
        this.updateRegionList();
        this.updateStatus('Previewing auto-detected regions - they will revert in 10 seconds unless you take action');

        // Create preview dialog
        const previewDialog = document.createElement('div');
        previewDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            z-index: 1000;
            max-width: 400px;
        `;

        previewDialog.innerHTML = `
            <h3>Preview Mode</h3>
            <p>Auto-detected regions are shown in <span style="color: #007acc;">blue</span>.</p>
            <p>Choose your action:</p>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="keepDetected" class="btn" style="background: #28a745; color: white;">Keep These</button>
                <button id="addToExisting" class="btn" style="background: #007acc; color: white;">Add to Existing</button>
                <button id="revertPreview" class="btn" style="background: #6c757d; color: white;">Revert</button>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #666;">
                Auto-reverting in <span id="countdown">10</span> seconds...
            </div>
        `;

        document.body.appendChild(previewDialog);

        // Countdown timer
        let countdown = 10;
        const countdownEl = document.getElementById('countdown');
        const timer = setInterval(() => {
            countdown--;
            if (countdownEl) countdownEl.textContent = countdown;
            if (countdown <= 0) {
                clearInterval(timer);
                this.revertPreview(originalRegions, previewDialog);
            }
        }, 1000);

        // Setup button handlers
        document.getElementById('keepDetected').onclick = () => {
            clearInterval(timer);
            previewDialog.remove();
            this.updateStatus(`Kept ${detectedRegions.length} auto-detected regions`);
            this.updateRegionList();
        };

        document.getElementById('addToExisting').onclick = () => {
            clearInterval(timer);
            previewDialog.remove();
            const mergedRegions = [...originalRegions, ...detectedRegions];
            CanvasManager.setRegions(mergedRegions);
            this.updateStatus(`Added ${detectedRegions.length} auto-detected regions to existing ${originalRegions.length}`);
            this.updateRegionList();
        };

        document.getElementById('revertPreview').onclick = () => {
            clearInterval(timer);
            this.revertPreview(originalRegions, previewDialog);
        };
    }

    /**
     * Revert preview to original regions
     */
    revertPreview(originalRegions, previewDialog) {
        CanvasManager.setRegions(originalRegions);
        this.updateRegionList();
        this.updateStatus('Reverted to original regions');
        previewDialog.remove();
    }

    updateRegionTypeSelect() {
        const select = document.getElementById('regionType');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '';

        // Add default options
        Utils.DEFAULT_REGION_TYPES.forEach(type => {
            const option = document.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            select.appendChild(option);
        });

        // Add custom types
        this.customTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });

        // Add "Custom..." option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom...';
        select.appendChild(customOption);

        // Restore selection if possible
        if (currentValue && [...select.options].find(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    exportRegions() {
        const data = this.generateRegionsData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        Utils.downloadBlob(blob, 'regions.json');
        this.updateStatus('Regions exported to regions.json');
    }

    saveTemplate() {
        const regions = CanvasManager.getRegions();
        if (regions.length === 0) {
            this.updateStatus('No regions to save as template');
            return;
        }

        const templateName = prompt('Template name:', `template_${Date.now()}`);
        if (!templateName) return;

        const template = {
            regions: regions,
            skew: CanvasManager.skewAngle,
            name: templateName,
            created: new Date().toISOString(),
            pageSize: {
                width: CanvasManager.image?.width || 0,
                height: CanvasManager.image?.height || 0
            }
        };

        localStorage.setItem('ocr_template_' + templateName, JSON.stringify(template));
        this.savedTemplates[templateName] = template;
        this.updateTemplateDropdown();

        // Auto-select the newly saved template
        const selectEl = document.getElementById('templateSelect');
        if (selectEl) {
            selectEl.value = templateName;
            this.currentTemplate = template;
        }

        this.updateStatus(`Template "${templateName}" saved with ${regions.length} regions`);
    }

    loadTemplate() {
        const selectEl = document.getElementById('templateSelect');
        const templateName = selectEl ? selectEl.value : null;

        if (!templateName) {
            this.updateStatus('Please select a template from the dropdown first');
            return;
        }

        const template = this.savedTemplates[templateName];
        if (template) {
            CanvasManager.setRegions(template.regions || []);

            const skew = template.skew || 0;
            CanvasManager.setSkew(skew);

            const slider = document.getElementById('skewSlider');
            if (slider) slider.value = skew;
            Utils.updateText('skewValue', skew + '°');

            this.currentTemplate = template;
            this.updateRegionList();
            this.updateStatus(`Template "${templateName}" loaded with ${template.regions?.length || 0} regions`);
        } else {
            this.updateStatus(`Template "${templateName}" not found`);
        }
    }

    // Tab Management
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const targetTab = document.getElementById(tabName + 'Tab');
        if (targetTab) targetTab.classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
        const targetContent = document.getElementById(tabName + 'Content');
        if (targetContent) targetContent.style.display = 'flex';

        if (tabName === 'processing') {
            this.updateCurrentDocInfo();
        } else if (tabName === 'review') {
            QualityReview.updateStats();
        }
    }

    updateCurrentDocInfo() {
        const info = document.getElementById('currentDocInfo');
        const processBtn = document.getElementById('processCurrentDoc');

        if (!info || !processBtn) return;

        if (this.currentFilename) {
            const regionCount = this.getTotalRegionCount();
            info.innerHTML = `
                <strong>Loaded:</strong> ${this.currentFilename}<br>
                <strong>Pages:</strong> ${this.totalPages}<br>
                <strong>Regions:</strong> ${regionCount}<br>
                <strong>Ready for processing</strong>
            `;
            processBtn.disabled = false;
        } else {
            info.textContent = 'No document loaded - switch to Region Editor tab to load a PDF';
            processBtn.disabled = true;
        }
    }

    getTotalRegionCount() {
        let total = 0;
        if (this.pdfDoc) {
            // Save current page regions first
            this.savePageRegions();
            for (let pageNum in this.pageRegions) {
                total += this.pageRegions[pageNum].length;
            }
        } else {
            total = CanvasManager.getRegions().length;
        }
        return total;
    }

    // Processing Functions
    async processCurrentDocument() {
        if (!this.currentPdfFile && !CanvasManager.image) {
            this.updateStatus('No document loaded');
            return;
        }

        try {
            this.showProcessingProgress();
            this.updateProgress(0, 'Preparing document...');

            // Generate regions data
            const regionsData = this.generateRegionsData();
            let totalRegions = 0;

            if (regionsData.pages) {
                for (let pageNum in regionsData.pages) {
                    totalRegions += regionsData.pages[pageNum].length;
                }
            } else {
                totalRegions = regionsData.regions ? regionsData.regions.length : 0;
            }

            if (totalRegions === 0) {
                throw new Error('No regions defined. Please draw some regions first.');
            }

            const outputFormat = document.getElementById('outputFormat').value;
            const imageQuality = document.getElementById('imageQuality').value;

            this.updateProgress(10, `Processing ${totalRegions} regions...`);

            const results = await this.processRegionsClientSide(regionsData, outputFormat, imageQuality);

            this.updateProgress(100, 'Complete!');
            this.showProcessingResults(results);

        } catch (error) {
            this.hideProcessingProgress();
            this.updateStatus('Processing error: ' + error.message);
        }
    }

    generateRegionsData() {
        const data = {
            file: {
                type: this.pdfDoc ? 'pdf' : 'image',
                totalPages: this.totalPages
            },
            image: {
                width: CanvasManager.image?.width || 0,
                height: CanvasManager.image?.height || 0
            },
            scale: CanvasManager.scale,
            skew: CanvasManager.skewAngle,
            pdf_name: this.currentFilename || 'document'
        };

        if (this.pdfDoc) {
            // Save current page regions
            this.savePageRegions();

            // Export all pages
            data.pages = {};
            for (let pageNum in this.pageRegions) {
                data.pages[pageNum] = this.pageRegions[pageNum].map(region => ({
                    ...region,
                    // Convert back to original image coordinates
                    x: region.x / CanvasManager.scale,
                    y: region.y / CanvasManager.scale,
                    width: region.width / CanvasManager.scale,
                    height: region.height / CanvasManager.scale
                }));
            }
        } else {
            // Single image export
            data.regions = CanvasManager.getRegions().map(region => ({
                ...region,
                // Convert back to original image coordinates
                x: region.x / CanvasManager.scale,
                y: region.y / CanvasManager.scale,
                width: region.width / CanvasManager.scale,
                height: region.height / CanvasManager.scale
            }));
        }

        return data;
    }

    async processRegionsClientSide(regionsData, outputFormat, imageQuality) {
        const progressCallback = (current, total, message) => {
            const percent = 10 + (current / total) * 80;
            this.updateProgress(percent, message);
        };

        if (regionsData.pages) {
            // Multi-page PDF processing
            return await ImageProcessor.processMultiPagePDF(
                this.originalPdfPages,
                regionsData,
                outputFormat,
                imageQuality,
                progressCallback
            );
        } else {
            // Single image processing
            return await ImageProcessor.processSingleImage(
                CanvasManager.image,
                regionsData.regions,
                regionsData.skew,
                outputFormat,
                imageQuality,
                progressCallback
            );
        }
    }

    showProcessingProgress() {
        Utils.toggleElement('processingProgress', true);
        Utils.toggleElement('processingResults', false);
    }

    hideProcessingProgress() {
        Utils.toggleElement('processingProgress', false);
    }

    updateProgress(percent, text) {
        const fillEl = document.getElementById('progressFill');
        const textEl = document.getElementById('progressText');

        if (fillEl) fillEl.style.width = percent + '%';
        if (textEl) textEl.textContent = text;
    }

    showProcessingResults(results) {
        this.hideProcessingProgress();

        const resultsDiv = document.getElementById('processingResults');
        const summaryDiv = document.getElementById('resultsSummary');
        const linksDiv = document.getElementById('downloadLinks');

        if (!resultsDiv || !summaryDiv || !linksDiv) return;

        summaryDiv.textContent = `Successfully processed ${results.total_slices} image slices`;

        linksDiv.innerHTML = '';

        if (results.zipUrl) {
            // ZIP download
            const zipLink = document.createElement('a');
            zipLink.href = results.zipUrl;
            zipLink.download = results.zipFilename;
            zipLink.className = 'download-link';
            zipLink.textContent = `Download ZIP (${results.total_slices} files)`;
            linksDiv.appendChild(zipLink);
        } else {
            // Individual downloads
            results.files.forEach(file => {
                const link = document.createElement('a');
                link.href = file.url;
                link.download = file.filename;
                link.className = 'download-link';
                link.textContent = file.filename;
                linksDiv.appendChild(link);
            });
        }

        resultsDiv.style.display = 'block';
        this.updateStatus(`Processing complete! ${results.total_slices} slices ready for download`);

        // Store slices for quality review
        QualityReview.storeSlicesForReview(results);
    }

    updateStatus(message) {
        Utils.updateText('status', message);
    }
}

// Export for global access
window.RegionEditor = RegionEditor;