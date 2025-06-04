/**
 * RegionEditorCore - Main editor class (simplified)
 */

class RegionEditor {
    constructor() {
        // PDF handling
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.pageRegions = {}; // Store regions for each page
        this.customTypes = []; // Store user-defined region types

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

    async loadFile(file) {
        if (!file) return;

        // Store current file info for processing
        this.currentPdfFile = file;
        this.currentFilename = file.name;
        this.updateCurrentDocInfo();

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

    async autoDetectRegions() {
        if (!CanvasManager.image) {
            this.updateStatus('No image loaded. Please load a document first.');
            return;
        }

        try {
            this.updateStatus('Auto-detecting regions...');

            // Create a canvas with the current image for analysis
            const analysisCanvas = document.createElement('canvas');
            const analysisCtx = analysisCanvas.getContext('2d');
            analysisCanvas.width = CanvasManager.image.width;
            analysisCanvas.height = CanvasManager.image.height;
            analysisCtx.drawImage(CanvasManager.image, 0, 0);

            // Get current regions as template (scaled back to original coordinates)
            const currentRegions = CanvasManager.getRegions();
            const templateRegions = currentRegions.map(region => ({
                x: region.x / CanvasManager.scale,
                y: region.y / CanvasManager.scale,
                width: region.width / CanvasManager.scale,
                height: region.height / CanvasManager.scale,
                type: region.type
            }));

            // Run auto-detection
            const result = await RegionDetector.autoDetectRegions(analysisCanvas, templateRegions, {
                threshold: 128,
                minRegionSize: 200,
                confidenceThreshold: 0.5
            });

            if (result.success && result.regions.length > 0) {
                // Convert detected regions back to canvas coordinates
                const detectedRegions = result.regions.map(region => ({
                    x: region.x * CanvasManager.scale,
                    y: region.y * CanvasManager.scale,
                    width: region.width * CanvasManager.scale,
                    height: region.height * CanvasManager.scale,
                    type: region.type,
                    confidence: region.confidence,
                    source: region.source
                }));

                // Ask user if they want to replace current regions or merge
                const action = confirm(
                    `Auto-detection found ${result.regions.length} regions.\n\n` +
                    `Current regions: ${currentRegions.length}\n` +
                    `Template used: ${result.metadata.usedTemplate ? 'Yes' : 'No'}\n\n` +
                    `Click OK to REPLACE current regions, Cancel to MERGE with existing.`
                );

                if (action) {
                    // Replace all regions
                    CanvasManager.setRegions(detectedRegions);
                    this.updateStatus(`Replaced regions with ${detectedRegions.length} auto-detected regions`);
                } else {
                    // Merge with existing regions
                    const mergedRegions = [...currentRegions, ...detectedRegions];
                    CanvasManager.setRegions(mergedRegions);
                    this.updateStatus(`Added ${detectedRegions.length} auto-detected regions (total: ${mergedRegions.length})`);
                }

                this.updateRegionList();

            } else if (result.success && result.regions.length === 0) {
                this.updateStatus('Auto-detection completed but no suitable regions found. Try adjusting the image or using manual region drawing.');
            } else {
                this.updateStatus('Auto-detection failed: ' + (result.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Auto-detection error:', error);
            this.updateStatus('Auto-detection failed: ' + error.message);
        }
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
        const template = {
            regions: CanvasManager.getRegions(),
            skew: CanvasManager.skewAngle,
            name: prompt('Template name:') || 'template'
        };

        localStorage.setItem('ocr_template_' + template.name, JSON.stringify(template));
        this.updateStatus(`Template "${template.name}" saved`);
    }

    loadTemplate() {
        const name = prompt('Template name to load:');
        if (!name) return;

        const template = localStorage.getItem('ocr_template_' + name);
        if (template) {
            const data = JSON.parse(template);
            CanvasManager.setRegions(data.regions || []);

            const skew = data.skew || 0;
            CanvasManager.setSkew(skew);

            const slider = document.getElementById('skewSlider');
            if (slider) slider.value = skew;
            Utils.updateText('skewValue', skew + '°');

            this.updateRegionList();
            this.updateStatus(`Template "${name}" loaded`);
        } else {
            this.updateStatus(`Template "${name}" not found`);
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