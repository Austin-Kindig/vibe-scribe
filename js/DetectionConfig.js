/**
 * DetectionConfig - Manages auto-detection configuration and UI
 */

window.DetectionConfig = {
    // Default configuration
    defaultConfig: {
        // Global settings
        global: {
            threshold: 128,
            minRegionSize: 200,
            confidenceThreshold: 0.5,
            preventOverlap: true,
            overlapTolerance: 5, // pixels
            templateAdherence: 0.7, // 0 = pure text-based, 1 = strict template
        },

        // Region-specific settings
        regionTypes: {
            'left-margin': {
                minConfidence: 0.3,
                boundaryExpansion: 5,
                maxWidthRatio: 0.15, // max 15% of page width
                preferTemplatePosition: true
            },
            'right-margin': {
                minConfidence: 0.3,
                boundaryExpansion: 5,
                maxWidthRatio: 0.15,
                preferTemplatePosition: true
            },
            'left-text': {
                minConfidence: 0.4,
                boundaryExpansion: 10,
                minWidthRatio: 0.25, // min 25% of page width
                allowHeightAdjustment: true
            },
            'right-text': {
                minConfidence: 0.4,
                boundaryExpansion: 10,
                minWidthRatio: 0.25,
                allowHeightAdjustment: true
            },
            'header': {
                minConfidence: 0.3,
                boundaryExpansion: 8,
                maxHeightRatio: 0.1, // max 10% of page height
                requireTextDensity: 0.05
            },
            'footer': {
                minConfidence: 0.3,
                boundaryExpansion: 8,
                maxHeightRatio: 0.1,
                requireTextDensity: 0.05
            }
        }
    },

    // Current active configuration
    currentConfig: null,

    // UI state
    configPanelOpen: false,
    autoRerunEnabled: false,
    previewMode: false,
    originalRegions: [],

    /**
     * Initialize the configuration system
     */
    init: function() {
        console.log('DetectionConfig.init() called');
        this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));
        console.log('Config initialized:', this.currentConfig);

        this.createConfigPanel();
        this.setupEventListeners();
        console.log('DetectionConfig initialization complete');
    },

    /**
     * Create the configuration panel UI
     */
    createConfigPanel: function() {
        console.log('Creating config panel...');

        // Create config button in toolbar
        const autoDetectBtn = document.getElementById('autoDetectRegions');
        console.log('Auto-detect button found:', !!autoDetectBtn);

        if (autoDetectBtn && !document.getElementById('configDetectionBtn')) {
            console.log('Creating config button');
            const configBtn = document.createElement('button');
            configBtn.id = 'configDetectionBtn';
            configBtn.className = 'btn';
            configBtn.textContent = '⚙️ Config';
            configBtn.title = 'Configure Auto-Detection Settings';
            configBtn.onclick = () => this.toggleConfigPanel();
            autoDetectBtn.parentNode.insertBefore(configBtn, autoDetectBtn.nextSibling);
            console.log('Config button created and inserted');
        } else if (document.getElementById('configDetectionBtn')) {
            console.log('Config button already exists');
        } else {
            console.error('Auto-detect button not found!');
        }

        // Create config panel (hidden by default)
        if (!document.getElementById('detectionConfigPanel')) {
            console.log('Creating config panel');
            const panel = document.createElement('div');
            panel.id = 'detectionConfigPanel';
            panel.className = 'detection-config-panel';
            panel.style.display = 'none';

            panel.innerHTML = this.generateConfigPanelHTML();

            // Insert after the region controls
            const regionControls = document.querySelector('.region-controls');
            console.log('Region controls found:', !!regionControls);

            if (regionControls) {
                regionControls.parentNode.insertBefore(panel, regionControls.nextSibling);
                console.log('Config panel created and inserted');
            } else {
                console.error('Region controls not found!');
                // Fallback: append to toolbar
                const toolbar = document.querySelector('.toolbar');
                if (toolbar) {
                    toolbar.appendChild(panel);
                    console.log('Config panel appended to toolbar as fallback');
                }
            }
        } else {
            console.log('Config panel already exists');
        }
    },

    /**
     * Generate the config panel HTML
     */
    generateConfigPanelHTML: function() {
        return `
            <div class="config-panel-header">
                <h4>Auto-Detection Configuration</h4>
                <div class="config-actions">
                    <button class="btn-small" onclick="DetectionConfig.resetToDefaults()">Reset</button>
                    <button class="btn-small" onclick="DetectionConfig.saveConfig()">Save</button>
                    <button class="btn-small" onclick="DetectionConfig.loadConfig()">Load</button>
                    <button class="btn-small" onclick="DetectionConfig.toggleConfigPanel()">✕</button>
                </div>
            </div>
            
            <div class="config-tabs">
                <button class="config-tab active" data-tab="global">Global</button>
                <button class="config-tab" data-tab="regions">Region Types</button>
                <button class="config-tab" data-tab="advanced">Advanced</button>
            </div>
            
            <div class="config-content">
                <div class="config-tab-content active" id="globalConfig">
                    ${this.generateGlobalConfigHTML()}
                </div>
                
                <div class="config-tab-content" id="regionsConfig">
                    ${this.generateRegionConfigHTML()}
                </div>
                
                <div class="config-tab-content" id="advancedConfig">
                    ${this.generateAdvancedConfigHTML()}
                </div>
            </div>
            
            <div class="config-preview">
                <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 10px;">
                    <label>
                        <input type="checkbox" onchange="DetectionConfig.toggleAutoRerun(this.checked)">
                        Auto-rerun detection when settings change
                    </label>
                    <label>
                        <input type="checkbox" onchange="DetectionConfig.toggleVisualPreview(this.checked)">
                        Show regions on canvas
                    </label>
                    <button class="btn-small" onclick="DetectionConfig.manualPreview()">📊 Preview Now</button>
                </div>
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
                        <button class="btn-small" onclick="DetectionConfig.runConfigurationSweep('quick')" style="background: #17a2b8; color: white;">
                            ⚡ Quick Test (10 configs)
                        </button>
                        <button class="btn-small" onclick="DetectionConfig.runConfigurationSweep('normal')" style="background: #28a745; color: white;">
                            🔍 Normal Test (50 configs)
                        </button>
                        <button class="btn-small" onclick="DetectionConfig.runConfigurationSweep('thorough')" style="background: #dc3545; color: white;">
                            🎯 Thorough Test (200+ configs)
                        </button>
                    </div>
                    <small style="color: #666;">Tests multiple configurations against your ideal regions</small>
                </div>
                <div id="configPreviewResults" class="config-preview-results"></div>
            </div>
        `;
    },

    /**
     * Generate global configuration controls
     */
    generateGlobalConfigHTML: function() {
        const config = this.currentConfig.global;
        return `
            <div class="config-section">
                <h5>Detection Parameters</h5>
                <div class="config-row">
                    <label>Text Threshold (0-255):</label>
                    <input type="range" min="50" max="200" value="${config.threshold}" 
                           onchange="DetectionConfig.updateConfig('global.threshold', this.value)">
                    <span class="config-value">${config.threshold}</span>
                </div>
                
                <div class="config-row">
                    <label>Min Region Size (pixels):</label>
                    <input type="range" min="50" max="500" value="${config.minRegionSize}" 
                           onchange="DetectionConfig.updateConfig('global.minRegionSize', this.value)">
                    <span class="config-value">${config.minRegionSize}</span>
                </div>
                
                <div class="config-row">
                    <label>Base Confidence Threshold:</label>
                    <input type="range" min="0.1" max="0.9" step="0.05" value="${config.confidenceThreshold}" 
                           onchange="DetectionConfig.updateConfig('global.confidenceThreshold', this.value)">
                    <span class="config-value">${config.confidenceThreshold}</span>
                </div>
            </div>
            
            <div class="config-section">
                <h5>Template Behavior</h5>
                <div class="config-row">
                    <label>Template Adherence:</label>
                    <input type="range" min="0" max="1" step="0.1" value="${config.templateAdherence}" 
                           onchange="DetectionConfig.updateConfig('global.templateAdherence', this.value)">
                    <span class="config-value">${config.templateAdherence}</span>
                    <small>0 = Text-based, 1 = Strict template</small>
                </div>
            </div>
            
            <div class="config-section">
                <h5>Overlap Prevention</h5>
                <div class="config-row">
                    <label>
                        <input type="checkbox" ${config.preventOverlap ? 'checked' : ''} 
                               onchange="DetectionConfig.updateConfig('global.preventOverlap', this.checked)">
                        Prevent Region Overlap
                    </label>
                </div>
                
                <div class="config-row">
                    <label>Overlap Tolerance (pixels):</label>
                    <input type="range" min="0" max="20" value="${config.overlapTolerance}" 
                           onchange="DetectionConfig.updateConfig('global.overlapTolerance', this.value)">
                    <span class="config-value">${config.overlapTolerance}</span>
                </div>
            </div>
        `;
    },

    /**
     * Generate region-specific configuration controls
     */
    generateRegionConfigHTML: function() {
        let html = '';

        Object.keys(this.currentConfig.regionTypes).forEach(regionType => {
            const config = this.currentConfig.regionTypes[regionType];
            html += `
                <div class="config-section">
                    <h5>${regionType.charAt(0).toUpperCase() + regionType.slice(1).replace('-', ' ')}</h5>
                    
                    <div class="config-row">
                        <label>Min Confidence:</label>
                        <input type="range" min="0.1" max="0.9" step="0.05" value="${config.minConfidence}" 
                               onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.minConfidence', this.value)">
                        <span class="config-value">${config.minConfidence}</span>
                    </div>
                    
                    <div class="config-row">
                        <label>Boundary Expansion:</label>
                        <input type="range" min="0" max="30" value="${config.boundaryExpansion}" 
                               onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.boundaryExpansion', this.value)">
                        <span class="config-value">${config.boundaryExpansion}px</span>
                    </div>
                    
                    ${this.generateRegionSpecificControls(regionType, config)}
                </div>
            `;
        });

        return html;
    },

    /**
     * Generate region-specific controls based on type
     */
    generateRegionSpecificControls: function(regionType, config) {
        let html = '';

        if (config.maxWidthRatio !== undefined) {
            html += `
                <div class="config-row">
                    <label>Max Width Ratio:</label>
                    <input type="range" min="0.05" max="0.5" step="0.05" value="${config.maxWidthRatio}" 
                           onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.maxWidthRatio', this.value)">
                    <span class="config-value">${Math.round(config.maxWidthRatio * 100)}%</span>
                </div>
            `;
        }

        if (config.minWidthRatio !== undefined) {
            html += `
                <div class="config-row">
                    <label>Min Width Ratio:</label>
                    <input type="range" min="0.1" max="0.8" step="0.05" value="${config.minWidthRatio}" 
                           onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.minWidthRatio', this.value)">
                    <span class="config-value">${Math.round(config.minWidthRatio * 100)}%</span>
                </div>
            `;
        }

        if (config.maxHeightRatio !== undefined) {
            html += `
                <div class="config-row">
                    <label>Max Height Ratio:</label>
                    <input type="range" min="0.02" max="0.3" step="0.02" value="${config.maxHeightRatio}" 
                           onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.maxHeightRatio', this.value)">
                    <span class="config-value">${Math.round(config.maxHeightRatio * 100)}%</span>
                </div>
            `;
        }

        if (config.preferTemplatePosition !== undefined) {
            html += `
                <div class="config-row">
                    <label>
                        <input type="checkbox" ${config.preferTemplatePosition ? 'checked' : ''} 
                               onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.preferTemplatePosition', this.checked)">
                        Prefer Template Position
                    </label>
                </div>
            `;
        }

        if (config.allowHeightAdjustment !== undefined) {
            html += `
                <div class="config-row">
                    <label>
                        <input type="checkbox" ${config.allowHeightAdjustment ? 'checked' : ''} 
                               onchange="DetectionConfig.updateConfig('regionTypes.${regionType}.allowHeightAdjustment', this.checked)">
                        Allow Height Adjustment
                    </label>
                </div>
            `;
        }

        return html;
    },

    /**
     * Generate advanced configuration controls
     */
    generateAdvancedConfigHTML: function() {
        return `
            <div class="config-section">
                <h5>Algorithm Tuning</h5>
                <div class="config-row">
                    <label>Text Grouping Distance:</label>
                    <input type="range" min="20" max="150" value="80" 
                           onchange="DetectionConfig.updateConfig('advanced.groupingDistance', this.value)">
                    <span class="config-value">80px</span>
                </div>
            </div>
            
            <div class="config-section">
                <h5>Export/Import</h5>
                <button class="btn-small" onclick="DetectionConfig.exportConfig()">Export Settings</button>
                <input type="file" id="configFileInput" accept=".json" style="display: none;" 
                       onchange="DetectionConfig.importConfig(this.files[0])">
                <button class="btn-small" onclick="document.getElementById('configFileInput').click()">Import Settings</button>
            </div>
        `;
    },

    /**
     * Setup event listeners
     */
    setupEventListeners: function() {
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('config-tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });

        // ESC key to close panel
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.configPanelOpen) {
                this.toggleConfigPanel();
            }
        });
    },

    /**
     * Toggle configuration panel visibility
     */
    toggleConfigPanel: function() {
        const panel = document.getElementById('detectionConfigPanel');
        if (panel) {
            this.configPanelOpen = !this.configPanelOpen;
            panel.style.display = this.configPanelOpen ? 'block' : 'none';

            if (this.configPanelOpen) {
                this.refreshConfigPanel();
            } else {
                // Exit preview mode when closing panel
                this.exitPreviewMode();
            }
        }
    },

    /**
     * Switch configuration tabs
     */
    switchTab: function(tabName) {
        // Update tab buttons
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.config-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName + 'Config');
        });
    },

    /**
     * Update configuration value
     */
    updateConfig: function(path, value) {
        const pathParts = path.split('.');
        let obj = this.currentConfig;

        // Navigate to the parent object
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (!obj[pathParts[i]]) {
                obj[pathParts[i]] = {};
            }
            obj = obj[pathParts[i]];
        }

        // Set the value with appropriate type conversion
        const finalKey = pathParts[pathParts.length - 1];
        if (typeof obj[finalKey] === 'number') {
            obj[finalKey] = parseFloat(value);
        } else if (typeof obj[finalKey] === 'boolean') {
            obj[finalKey] = value;
        } else {
            obj[finalKey] = value;
        }

        // Update the display value
        this.updateConfigDisplay(path, value);

        // Trigger preview update if enabled
        this.schedulePreviewUpdate();
    },

    /**
     * Update configuration display value
     */
    updateConfigDisplay: function(path, value) {
        const input = document.querySelector(`input[onchange*="${path}"]`);
        if (input && input.nextElementSibling && input.nextElementSibling.classList.contains('config-value')) {
            const displayValue = path.includes('Ratio') ? Math.round(value * 100) + '%' :
                path.includes('Expansion') ? value + 'px' : value;
            input.nextElementSibling.textContent = displayValue;
        }
    },

    /**
     * Toggle auto-rerun functionality
     */
    toggleAutoRerun: function(enabled) {
        this.autoRerunEnabled = enabled;
        console.log('Auto-rerun detection:', enabled ? 'enabled' : 'disabled');

        if (enabled) {
            this.showPreviewMessage('Auto-rerun enabled - detection will run automatically when you change settings');
            // Run initial detection if image is loaded
            if (window.CanvasManager && window.CanvasManager.image) {
                this.schedulePreviewUpdate();
            }
        } else {
            this.showPreviewMessage('Auto-rerun disabled - use "Preview Now" button to test settings');
        }
    },

    /**
     * Toggle visual preview on canvas
     */
    toggleVisualPreview: function(enabled) {
        this.visualPreviewEnabled = enabled;
        console.log('Visual preview:', enabled ? 'enabled' : 'disabled');

        if (enabled) {
            // Store original regions before showing preview
            if (!this.previewMode && window.CanvasManager) {
                this.originalRegions = [...window.CanvasManager.getRegions()];
                this.previewMode = true;
            }
            this.showPreviewMessage('Visual preview enabled - detected regions will show on canvas');
            // Run detection if auto-rerun is enabled
            if (this.autoRerunEnabled) {
                this.schedulePreviewUpdate();
            }
        } else {
            // Restore original regions
            this.exitPreviewMode();
            this.showPreviewMessage('Visual preview disabled');
        }
    },

    /**
     * Exit preview mode and restore original regions
     */
    exitPreviewMode: function() {
        if (this.previewMode && window.CanvasManager && this.originalRegions) {
            window.CanvasManager.setRegions([...this.originalRegions]);
            if (window.editor && window.editor.updateRegionList) {
                window.editor.updateRegionList();
            }
            this.previewMode = false;
            console.log('Restored original regions');
        }
    },

    /**
     * Schedule preview update (debounced) - now respects auto-rerun setting
     */
    schedulePreviewUpdate: function() {
        clearTimeout(this.previewTimeout);

        if (!this.autoRerunEnabled) {
            // Don't auto-run if disabled
            return;
        }

        this.previewTimeout = setTimeout(() => {
            if (this.configPanelOpen && window.CanvasManager && window.CanvasManager.image) {
                this.previewSettings();
            }
        }, 1000);
    },

    /**
     * Manual preview trigger (always runs regardless of auto-rerun setting)
     */
    manualPreview: function() {
        if (window.CanvasManager && window.CanvasManager.image) {
            this.previewSettings();
        } else {
            this.showPreviewMessage('No image loaded for preview');
        }
    },

    /**
     * Preview current settings on the loaded image
     */
    previewSettings: async function() {
        if (!window.CanvasManager || !window.CanvasManager.image) {
            this.showPreviewMessage('No image loaded for preview');
            return;
        }

        try {
            this.showPreviewMessage('Running preview...');

            // Get current template regions
            const templateRegions = window.CanvasManager.getRegions().map(region => ({
                x: region.x / window.CanvasManager.scale,
                y: region.y / window.CanvasManager.scale,
                width: region.width / window.CanvasManager.scale,
                height: region.height / window.CanvasManager.scale,
                type: region.type
            }));

            // Create analysis canvas
            const analysisCanvas = document.createElement('canvas');
            const analysisCtx = analysisCanvas.getContext('2d');
            analysisCanvas.width = window.CanvasManager.image.width;
            analysisCanvas.height = window.CanvasManager.image.height;
            analysisCtx.drawImage(window.CanvasManager.image, 0, 0);

            // Run detection with current config
            const result = await window.RegionDetector.autoDetectRegions(
                analysisCanvas,
                templateRegions,
                this.getDetectionOptions()
            );

            if (result.success) {
                this.showPreviewResults(result);
            } else {
                this.showPreviewMessage('Preview failed: ' + result.error);
            }

        } catch (error) {
            this.showPreviewMessage('Preview error: ' + error.message);
        }
    },

    /**
     * Show preview message
     */
    showPreviewMessage: function(message) {
        const resultsDiv = document.getElementById('configPreviewResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = `<div class="preview-message">${message}</div>`;
        }
    },

    /**
     * Show preview results
     */
    showPreviewResults: function(result) {
        const resultsDiv = document.getElementById('configPreviewResults');
        if (!resultsDiv) return;

        let html = `
            <div class="preview-summary">
                <strong>Preview Results:</strong> ${result.regions.length} regions found
            </div>
            <div class="preview-regions">
        `;

        result.regions.forEach((region, index) => {
            html += `
                <div class="preview-region">
                    <span class="region-type">${region.type}</span>
                    <span class="region-confidence">${Math.round(region.confidence * 100)}%</span>
                    <span class="region-coords">${Math.round(region.x)},${Math.round(region.y)} ${Math.round(region.width)}×${Math.round(region.height)}</span>
                </div>
            `;
        });

        html += '</div>';
        resultsDiv.innerHTML = html;

        // Show regions on canvas if visual preview is enabled
        if (this.visualPreviewEnabled && window.CanvasManager) {
            // Convert regions to display coordinates
            const displayRegions = result.regions.map(region => ({
                x: region.x * window.CanvasManager.scale,
                y: region.y * window.CanvasManager.scale,
                width: region.width * window.CanvasManager.scale,
                height: region.height * window.CanvasManager.scale,
                type: region.type,
                confidence: region.confidence,
                source: region.source
            }));

            // Store original regions if not already in preview mode
            if (!this.previewMode) {
                this.originalRegions = [...window.CanvasManager.getRegions()];
                this.previewMode = true;
            }

            // Show detected regions on canvas
            window.CanvasManager.setRegions(displayRegions);
            if (window.editor && window.editor.updateRegionList) {
                window.editor.updateRegionList();
            }
        }
    },

    /**
     * Get detection options from current config
     */
    getDetectionOptions: function() {
        return {
            threshold: this.currentConfig.global.threshold,
            minRegionSize: this.currentConfig.global.minRegionSize,
            confidenceThreshold: this.currentConfig.global.confidenceThreshold,
            preventOverlap: this.currentConfig.global.preventOverlap,
            overlapTolerance: this.currentConfig.global.overlapTolerance,
            templateAdherence: this.currentConfig.global.templateAdherence,
            regionTypeConfig: this.currentConfig.regionTypes
        };
    },

    /**
     * Refresh configuration panel with current values
     */
    refreshConfigPanel: function() {
        const panel = document.getElementById('detectionConfigPanel');
        if (panel) {
            panel.innerHTML = this.generateConfigPanelHTML();
        }
    },

    /**
     * Reset to default configuration
     */
    resetToDefaults: function() {
        if (confirm('Reset all settings to defaults?')) {
            this.currentConfig = JSON.parse(JSON.stringify(this.defaultConfig));
            this.refreshConfigPanel();
        }
    },

    /**
     * Save current configuration
     */
    saveConfig: function() {
        const name = prompt('Configuration name:', 'detection_config_' + Date.now());
        if (name) {
            localStorage.setItem('detection_config_' + name, JSON.stringify(this.currentConfig));
            if (window.editor && window.editor.updateStatus) {
                window.editor.updateStatus(`Configuration "${name}" saved`);
            }
        }
    },

    /**
     * Load saved configuration
     */
    loadConfig: function() {
        const name = prompt('Configuration name to load:');
        if (name) {
            const saved = localStorage.getItem('detection_config_' + name);
            if (saved) {
                this.currentConfig = JSON.parse(saved);
                this.refreshConfigPanel();
                if (window.editor && window.editor.updateStatus) {
                    window.editor.updateStatus(`Configuration "${name}" loaded`);
                }
            } else {
                alert('Configuration not found');
            }
        }
    },

    /**
     * Export configuration as JSON
     */
    exportConfig: function() {
        const blob = new Blob([JSON.stringify(this.currentConfig, null, 2)], { type: 'application/json' });
        const filename = 'detection_config.json';
        if (window.Utils && window.Utils.downloadBlob) {
            window.Utils.downloadBlob(blob, filename);
        }
    },

    /**
     * Import configuration from file
     */
    importConfig: async function(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const config = JSON.parse(text);
            this.currentConfig = config;
            this.refreshConfigPanel();

            if (window.editor && window.editor.updateStatus) {
                window.editor.updateStatus('Configuration imported successfully');
            }
        } catch (error) {
            alert('Failed to import configuration: ' + error.message);
        }
    },

    /**
     * Run automated configuration sweep to find best settings
     */
    runConfigurationSweep: async function() {
        if (!window.CanvasManager || !window.CanvasManager.image) {
            this.showPreviewMessage('No image loaded for configuration sweep');
            return;
        }

        const idealRegions = window.CanvasManager.getRegions();
        if (idealRegions.length === 0) {
            this.showPreviewMessage('No ideal regions defined. Please draw regions first to compare against.');
            return;
        }

        console.log('🔍 Starting configuration sweep...');
        this.showPreviewMessage('Generating test configurations...');

        try {
            // Generate test configurations
            const testConfigs = this.generateTestConfigurations();
            console.log(`Generated ${testConfigs.length} test configurations`);

            const results = [];

            // Get template regions for testing
            const templateRegions = idealRegions.map(region => ({
                x: region.x / window.CanvasManager.scale,
                y: region.y / window.CanvasManager.scale,
                width: region.width / window.CanvasManager.scale,
                height: region.height / window.CanvasManager.scale,
                type: region.type
            }));

            // Create analysis canvas
            const analysisCanvas = document.createElement('canvas');
            const analysisCtx = analysisCanvas.getContext('2d');
            analysisCanvas.width = window.CanvasManager.image.width;
            analysisCanvas.height = window.CanvasManager.image.height;
            analysisCtx.drawImage(window.CanvasManager.image, 0, 0);

            // Test each configuration
            let successful = 0;
            let failed = 0;

            for (let i = 0; i < testConfigs.length; i++) {
                const config = testConfigs[i];
                const progress = Math.round((i + 1) / testConfigs.length * 100);

                this.showPreviewMessage(
                    `Testing configurations... ${progress}% (${i + 1}/${testConfigs.length})<br>` +
                    `Current: ${config.name}<br>` +
                    `✅ ${successful} successful, ❌ ${failed} failed`
                );

                try {
                    const detectionOptions = {
                        threshold: config.settings.threshold,
                        minRegionSize: config.settings.minRegionSize,
                        confidenceThreshold: config.settings.confidenceThreshold,
                        preventOverlap: config.settings.preventOverlap,
                        overlapTolerance: config.settings.overlapTolerance,
                        templateAdherence: config.settings.templateAdherence,
                        useTemplateGuidance: templateRegions.length > 0,
                        regionTypeConfig: config.regionTypeConfig || this.currentConfig.regionTypes
                    };

                    const result = await window.RegionDetector.autoDetectRegions(
                        analysisCanvas,
                        templateRegions,
                        detectionOptions
                    );

                    if (result.success && result.regions) {
                        // Calculate similarity score
                        const score = this.calculateSimilarityScore(idealRegions, result.regions, window.CanvasManager.scale);

                        results.push({
                            config: config,
                            detectedRegions: result.regions,
                            score: score,
                            metadata: result.metadata
                        });

                        successful++;
                        console.log(`✅ ${config.name} score: ${score.overall.toFixed(3)}`);
                    } else {
                        failed++;
                        console.warn(`❌ ${config.name} failed: no regions detected`);
                    }
                } catch (error) {
                    failed++;
                    console.warn(`❌ ${config.name} failed:`, error.message);
                }

                // Small delay to prevent UI blocking
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            // Sort by overall score (higher is better)
            results.sort((a, b) => b.score.overall - a.score.overall);

            console.log(`🏆 Configuration sweep complete! ${successful} successful, ${failed} failed`);
            console.log('Top 5 configurations:', results.slice(0, 5).map(r => ({
                name: r.config.name,
                score: r.score.overall.toFixed(3)
            })));

            this.showSweepResults(results, idealRegions);

        } catch (error) {
            console.error('Configuration sweep failed:', error);
            this.showPreviewMessage('Configuration sweep failed: ' + error.message);
        }
    },

    /**
     * Run automated configuration sweep to find best settings
     */
    runConfigurationSweep: async function(testMode = 'normal') {
        if (!window.CanvasManager || !window.CanvasManager.image) {
            this.showPreviewMessage('No image loaded for configuration sweep');
            return;
        }

        const idealRegions = window.CanvasManager.getRegions();
        if (idealRegions.length === 0) {
            this.showPreviewMessage('No ideal regions defined. Please draw regions first to compare against.');
            return;
        }

        const testModeInfo = {
            quick: { name: 'Quick Test', configs: 10, description: '~5 seconds', color: '#17a2b8' },
            normal: { name: 'Normal Test', configs: 50, description: '~15 seconds', color: '#28a745' },
            thorough: { name: 'Thorough Test', configs: 200, description: '~60 seconds', color: '#dc3545' }
        };

        const modeInfo = testModeInfo[testMode];
        console.log(`🔍 Starting ${modeInfo.name} (${modeInfo.configs} configurations)...`);
        this.showPreviewMessage(`Starting ${modeInfo.name} - generating configurations...`);

        try {
            // Generate test configurations based on mode
            const testConfigs = this.generateTestConfigurations(testMode);
            console.log(`Generated ${testConfigs.length} configurations for ${modeInfo.name}`);

            const results = [];

            // Get template regions for testing
            const templateRegions = idealRegions.map(region => ({
                x: region.x / window.CanvasManager.scale,
                y: region.y / window.CanvasManager.scale,
                width: region.width / window.CanvasManager.scale,
                height: region.height / window.scale,
                type: region.type
            }));

            // Create analysis canvas
            const analysisCanvas = document.createElement('canvas');
            const analysisCtx = analysisCanvas.getContext('2d');
            analysisCanvas.width = window.CanvasManager.image.width;
            analysisCanvas.height = window.CanvasManager.image.height;
            analysisCtx.drawImage(window.CanvasManager.image, 0, 0);

            // Test each configuration with mode-specific timing
            let successful = 0;
            let failed = 0;
            const startTime = Date.now();

            for (let i = 0; i < testConfigs.length; i++) {
                const config = testConfigs[i];
                const progress = Math.round((i + 1) / testConfigs.length * 100);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                this.showPreviewMessage(
                    `<div style="color: ${modeInfo.color}; font-weight: bold;">${modeInfo.name} - ${progress}%</div>` +
                    `Testing: ${config.name} (${config.category || 'standard'})<br>` +
                    `Progress: ${i + 1}/${testConfigs.length} | Time: ${elapsed}s<br>` +
                    `✅ ${successful} successful, ❌ ${failed} failed`
                );

                try {
                    const detectionOptions = {
                        threshold: config.settings.threshold,
                        minRegionSize: config.settings.minRegionSize,
                        confidenceThreshold: config.settings.confidenceThreshold,
                        preventOverlap: config.settings.preventOverlap,
                        overlapTolerance: config.settings.overlapTolerance,
                        templateAdherence: config.settings.templateAdherence,
                        useTemplateGuidance: templateRegions.length > 0,
                        regionTypeConfig: this.currentConfig.regionTypes
                    };

                    const result = await window.RegionDetector.autoDetectRegions(
                        analysisCanvas,
                        templateRegions,
                        detectionOptions
                    );

                    if (result.success && result.regions) {
                        // Calculate similarity score
                        const score = this.calculateSimilarityScore(idealRegions, result.regions, window.CanvasManager.scale);

                        results.push({
                            config: config,
                            detectedRegions: result.regions,
                            score: score,
                            metadata: result.metadata
                        });

                        successful++;
                        console.log(`✅ ${config.name} score: ${score.overall.toFixed(3)}`);
                    } else {
                        failed++;
                        console.warn(`❌ ${config.name} failed: no regions detected`);
                    }
                } catch (error) {
                    failed++;
                    console.warn(`❌ ${config.name} failed:`, error.message);
                }

                // Mode-specific delays to prevent UI blocking
                const delayInterval = testMode === 'quick' ? 3 : testMode === 'normal' ? 5 : 8;
                if (i % delayInterval === 0) {
                    await new Promise(resolve => setTimeout(resolve, testMode === 'thorough' ? 5 : 1));
                }
            }

            // Sort by overall score (higher is better)
            results.sort((a, b) => b.score.overall - a.score.overall);

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`🏆 ${modeInfo.name} complete in ${totalTime}s! ${successful} successful, ${failed} failed`);

            // Show results with mode-specific information
            this.showSweepResults(results, idealRegions, {
                testMode: modeInfo.name,
                totalTime: totalTime,
                totalConfigs: testConfigs.length
            });

        } catch (error) {
            console.error('Configuration sweep failed:', error);
            this.showPreviewMessage('Configuration sweep failed: ' + error.message);
        }
    },

    /**
     * Generate test configurations based on test mode
     */
    generateTestConfigurations: function(testMode = 'normal') {
        const configs = [];

        if (testMode === 'quick') {
            // Quick test - 10 configurations with varied region-specific settings
            const quickConfigs = [
                {
                    name: 'Balanced_Default',
                    global: { threshold: 128, adherence: 0.7, confidence: 0.4, overlap: true },
                    regionVariant: 'default'
                },
                {
                    name: 'HighPrecision_Template',
                    global: { threshold: 120, adherence: 0.8, confidence: 0.5, overlap: true },
                    regionVariant: 'precision'
                },
                {
                    name: 'TextFocused_Loose',
                    global: { threshold: 140, adherence: 0.5, confidence: 0.3, overlap: true },
                    regionVariant: 'loose'
                },
                {
                    name: 'StrictTemplate_TightRegions',
                    global: { threshold: 110, adherence: 0.9, confidence: 0.6, overlap: true },
                    regionVariant: 'strict'
                },
                {
                    name: 'LooseDetection_BigMargins',
                    global: { threshold: 150, adherence: 0.4, confidence: 0.4, overlap: false },
                    regionVariant: 'expanded'
                },
                {
                    name: 'Conservative_SmallExpansion',
                    global: { threshold: 128, adherence: 0.6, confidence: 0.5, overlap: true },
                    regionVariant: 'conservative'
                },
                {
                    name: 'HighRecall_LooseMargins',
                    global: { threshold: 135, adherence: 0.7, confidence: 0.35, overlap: true },
                    regionVariant: 'loose_margins'
                },
                {
                    name: 'FineTuned_OptimalExpansion',
                    global: { threshold: 115, adherence: 0.75, confidence: 0.45, overlap: true },
                    regionVariant: 'optimal'
                },
                {
                    name: 'NoOverlap_TightBounds',
                    global: { threshold: 128, adherence: 0.5, confidence: 0.4, overlap: false },
                    regionVariant: 'tight'
                },
                {
                    name: 'OptimalMix_AdaptiveRegions',
                    global: { threshold: 125, adherence: 0.65, confidence: 0.4, overlap: true },
                    regionVariant: 'adaptive'
                }
            ];

            quickConfigs.forEach((config, index) => {
                configs.push({
                    name: config.name,
                    category: 'quick',
                    settings: {
                        threshold: config.global.threshold,
                        minRegionSize: 200,
                        confidenceThreshold: config.global.confidence,
                        preventOverlap: config.global.overlap,
                        overlapTolerance: config.global.overlap ? 5 : 0,
                        templateAdherence: config.global.adherence
                    },
                    regionTypeConfig: this.generateRegionVariant(config.regionVariant)
                });
            });

        } else if (testMode === 'normal') {
            // Normal test - 50+ configurations with systematic region variations
            const globalCombos = [
                { threshold: 100, adherence: 0.4, confidence: 0.3 },
                { threshold: 115, adherence: 0.6, confidence: 0.4 },
                { threshold: 128, adherence: 0.7, confidence: 0.4 },
                { threshold: 140, adherence: 0.6, confidence: 0.5 },
                { threshold: 160, adherence: 0.8, confidence: 0.5 }
            ];

            const regionVariants = ['default', 'precision', 'loose', 'strict', 'expanded', 'conservative'];
            const overlapSettings = [true, false];

            globalCombos.forEach(global => {
                regionVariants.forEach(variant => {
                    overlapSettings.forEach(preventOverlap => {
                        configs.push({
                            name: `T${global.threshold}_A${global.adherence}_C${global.confidence}_${variant}_O${preventOverlap ? 'Y' : 'N'}`,
                            category: 'normal',
                            settings: {
                                threshold: global.threshold,
                                minRegionSize: 200,
                                confidenceThreshold: global.confidence,
                                preventOverlap: preventOverlap,
                                overlapTolerance: preventOverlap ? 5 : 0,
                                templateAdherence: global.adherence
                            },
                            regionTypeConfig: this.generateRegionVariant(variant)
                        });
                    });
                });
            });

        } else if (testMode === 'thorough') {
            // Thorough test - 200+ configurations with comprehensive region testing
            const thresholds = [90, 100, 115, 128, 140, 160, 180];
            const adherenceValues = [0.3, 0.5, 0.7, 0.9];
            const confidenceThresholds = [0.3, 0.4, 0.5, 0.6];
            const regionVariants = ['default', 'precision', 'loose', 'strict', 'expanded', 'conservative', 'adaptive', 'tight'];

            // Comprehensive global + region combinations
            thresholds.forEach(threshold => {
                adherenceValues.forEach(adherence => {
                    confidenceThresholds.forEach(confidence => {
                        regionVariants.forEach(variant => {
                            configs.push({
                                name: `Thorough_T${threshold}_A${adherence}_C${confidence}_${variant}`,
                                category: 'thorough',
                                settings: {
                                    threshold: threshold,
                                    minRegionSize: 200,
                                    confidenceThreshold: confidence,
                                    preventOverlap: true,
                                    overlapTolerance: 5,
                                    templateAdherence: adherence
                                },
                                regionTypeConfig: this.generateRegionVariant(variant)
                            });
                        });
                    });
                });
            });

            // Region-specific focused tests
            const regionSizes = [150, 200, 250, 300];
            regionSizes.forEach(size => {
                regionVariants.forEach(variant => {
                    configs.push({
                        name: `RegionSize_${size}_${variant}`,
                        category: 'region_focus',
                        settings: {
                            threshold: 128,
                            minRegionSize: size,
                            confidenceThreshold: 0.4,
                            preventOverlap: true,
                            overlapTolerance: 5,
                            templateAdherence: 0.6
                        },
                        regionTypeConfig: this.generateRegionVariant(variant)
                    });
                });
            });

            // Margin-specific tuning
            const marginExpansions = [0, 3, 5, 8, 12, 20];
            marginExpansions.forEach(expansion => {
                configs.push({
                    name: `MarginExpansion_${expansion}`,
                    category: 'margin_tuning',
                    settings: {
                        threshold: 128,
                        minRegionSize: 200,
                        confidenceThreshold: 0.4,
                        preventOverlap: true,
                        overlapTolerance: 5,
                        templateAdherence: 0.7
                    },
                    regionTypeConfig: this.generateMarginFocusedVariant(expansion)
                });
            });
        }

        console.log(`Generated ${configs.length} configurations for ${testMode} test (including region-specific variants)`);
        return configs;
    },

    /**
     * Generate region-specific configuration variants
     */
    generateRegionVariant: function(variantType) {
        const baseConfig = JSON.parse(JSON.stringify(this.currentConfig.regionTypes));

        switch (variantType) {
            case 'precision':
                // High precision - strict settings
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].minConfidence = Math.min(0.7, baseConfig[type].minConfidence + 0.3);
                    baseConfig[type].boundaryExpansion = Math.max(2, baseConfig[type].boundaryExpansion - 3);
                    if (baseConfig[type].preferTemplatePosition !== undefined) {
                        baseConfig[type].preferTemplatePosition = true;
                    }
                });
                break;

            case 'loose':
                // Loose detection - find more regions
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].minConfidence = Math.max(0.2, baseConfig[type].minConfidence - 0.2);
                    baseConfig[type].boundaryExpansion = baseConfig[type].boundaryExpansion + 8;
                    if (baseConfig[type].allowHeightAdjustment !== undefined) {
                        baseConfig[type].allowHeightAdjustment = true;
                    }
                });
                break;

            case 'strict':
                // Very strict - template adherence
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].minConfidence = Math.min(0.8, baseConfig[type].minConfidence + 0.4);
                    baseConfig[type].boundaryExpansion = Math.max(1, baseConfig[type].boundaryExpansion - 5);
                    if (baseConfig[type].preferTemplatePosition !== undefined) {
                        baseConfig[type].preferTemplatePosition = true;
                    }
                    if (baseConfig[type].allowHeightAdjustment !== undefined) {
                        baseConfig[type].allowHeightAdjustment = false;
                    }
                });
                break;

            case 'expanded':
                // Large boundary expansions
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].boundaryExpansion = baseConfig[type].boundaryExpansion + 15;
                    baseConfig[type].minConfidence = Math.max(0.25, baseConfig[type].minConfidence - 0.15);
                });
                break;

            case 'conservative':
                // Small, careful adjustments
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].boundaryExpansion = Math.max(2, baseConfig[type].boundaryExpansion - 2);
                    baseConfig[type].minConfidence = Math.min(0.6, baseConfig[type].minConfidence + 0.1);
                });
                break;

            case 'loose_margins':
                // Specific to margin regions
                ['left-margin', 'right-margin'].forEach(type => {
                    if (baseConfig[type]) {
                        baseConfig[type].minConfidence = 0.2;
                        baseConfig[type].boundaryExpansion = 15;
                        baseConfig[type].maxWidthRatio = 0.25; // Allow wider margins
                    }
                });
                break;

            case 'optimal':
                // Balanced optimal settings
                Object.keys(baseConfig).forEach(type => {
                    if (type.includes('margin')) {
                        baseConfig[type].minConfidence = 0.35;
                        baseConfig[type].boundaryExpansion = 8;
                    } else if (type.includes('text')) {
                        baseConfig[type].minConfidence = 0.45;
                        baseConfig[type].boundaryExpansion = 12;
                    } else {
                        baseConfig[type].minConfidence = 0.4;
                        baseConfig[type].boundaryExpansion = 10;
                    }
                });
                break;

            case 'adaptive':
                // Different settings per region type
                Object.keys(baseConfig).forEach(type => {
                    if (type === 'header' || type === 'footer') {
                        baseConfig[type].minConfidence = 0.3;
                        baseConfig[type].boundaryExpansion = 6;
                    } else if (type.includes('margin')) {
                        baseConfig[type].minConfidence = 0.25;
                        baseConfig[type].boundaryExpansion = 3;
                        baseConfig[type].preferTemplatePosition = true;
                    } else if (type.includes('text')) {
                        baseConfig[type].minConfidence = 0.5;
                        baseConfig[type].boundaryExpansion = 15;
                        baseConfig[type].allowHeightAdjustment = true;
                    }
                });
                break;

            case 'tight':
                // Minimal boundary expansion
                Object.keys(baseConfig).forEach(type => {
                    baseConfig[type].boundaryExpansion = Math.max(0, baseConfig[type].boundaryExpansion - 8);
                    baseConfig[type].minConfidence = Math.min(0.7, baseConfig[type].minConfidence + 0.2);
                });
                break;

            case 'default':
            default:
                // Keep base configuration
                break;
        }

        return baseConfig;
    },

    /**
     * Generate margin-focused configuration variant
     */
    generateMarginFocusedVariant: function(expansion) {
        const baseConfig = JSON.parse(JSON.stringify(this.currentConfig.regionTypes));

        // Apply expansion specifically to margin types
        ['left-margin', 'right-margin'].forEach(type => {
            if (baseConfig[type]) {
                baseConfig[type].boundaryExpansion = expansion;
                // Adjust confidence based on expansion
                if (expansion === 0) {
                    baseConfig[type].minConfidence = 0.6; // High confidence for no expansion
                } else if (expansion > 10) {
                    baseConfig[type].minConfidence = 0.3; // Lower confidence for large expansion
                } else {
                    baseConfig[type].minConfidence = 0.4; // Moderate confidence
                }
            }
        });

        return baseConfig;
    },

    /**
     * Calculate similarity score between ideal and detected regions
     */
    calculateSimilarityScore: function(idealRegions, detectedRegions, scale) {
        const idealScaled = idealRegions.map(region => ({
            x: region.x / scale,
            y: region.y / scale,
            width: region.width / scale,
            height: region.height / scale,
            type: region.type
        }));

        let totalIoU = 0;
        let typeMatches = 0;
        let regionMatches = 0;
        let positionErrors = [];

        // For each ideal region, find best matching detected region
        idealScaled.forEach(ideal => {
            let bestMatch = null;
            let bestIoU = 0;

            detectedRegions.forEach(detected => {
                const iou = this.calculateIoU(ideal, detected);
                if (iou > bestIoU) {
                    bestIoU = iou;
                    bestMatch = detected;
                }
            });

            if (bestMatch) {
                totalIoU += bestIoU;

                // Check type match
                if (bestMatch.type === ideal.type) {
                    typeMatches++;
                }

                // Check if it's a reasonable match (IoU > 0.3)
                if (bestIoU > 0.3) {
                    regionMatches++;
                }

                // Calculate position error
                const centerXIdeal = ideal.x + ideal.width / 2;
                const centerYIdeal = ideal.y + ideal.height / 2;
                const centerXDetected = bestMatch.x + bestMatch.width / 2;
                const centerYDetected = bestMatch.y + bestMatch.height / 2;

                const positionError = Math.sqrt(
                    Math.pow(centerXIdeal - centerXDetected, 2) +
                    Math.pow(centerYIdeal - centerYDetected, 2)
                );
                positionErrors.push(positionError);
            }
        });

        const avgIoU = idealScaled.length > 0 ? totalIoU / idealScaled.length : 0;
        const typeAccuracy = idealScaled.length > 0 ? typeMatches / idealScaled.length : 0;
        const regionRecall = idealScaled.length > 0 ? regionMatches / idealScaled.length : 0;
        const avgPositionError = positionErrors.length > 0 ?
            positionErrors.reduce((a, b) => a + b, 0) / positionErrors.length : 0;

        // Count penalty for extra regions
        const extraRegionsPenalty = Math.max(0, detectedRegions.length - idealScaled.length) * 0.1;

        // Overall score (higher is better)
        const overall = (avgIoU * 0.4 + typeAccuracy * 0.3 + regionRecall * 0.3) - extraRegionsPenalty;

        return {
            overall: Math.max(0, overall),
            avgIoU: avgIoU,
            typeAccuracy: typeAccuracy,
            regionRecall: regionRecall,
            avgPositionError: avgPositionError,
            extraRegions: Math.max(0, detectedRegions.length - idealScaled.length)
        };
    },

    /**
     * Calculate Intersection over Union (IoU) between two regions
     */
    calculateIoU: function(region1, region2) {
        const x1 = Math.max(region1.x, region2.x);
        const y1 = Math.max(region1.y, region2.y);
        const x2 = Math.min(region1.x + region1.width, region2.x + region2.width);
        const y2 = Math.min(region1.y + region1.height, region2.y + region2.height);

        if (x1 >= x2 || y1 >= y2) return 0;

        const intersection = (x2 - x1) * (y2 - y1);
        const area1 = region1.width * region1.height;
        const area2 = region2.width * region2.height;
        const union = area1 + area2 - intersection;

        return union > 0 ? intersection / union : 0;
    },

    /**
     * Show configuration sweep results with test mode information
     */
    showSweepResults: function(results, idealRegions, testInfo = {}) {
        const resultsDiv = document.getElementById('configPreviewResults');
        if (!resultsDiv) return;

        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="preview-message">No valid configurations found</div>';
            return;
        }

        const topResults = results.slice(0, 10); // Show more results for thorough tests

        let html = `
            <div class="sweep-results">
                <div class="preview-summary">
                    <strong>🏆 ${testInfo.testMode || 'Configuration Test'} Results</strong><br>
                    Tested ${testInfo.totalConfigs || results.length} configurations in ${testInfo.totalTime || 'unknown'}s against ${idealRegions.length} ideal regions<br>
                    <small style="color: #666;">Found ${results.length} valid configurations</small>
                </div>
                <div class="top-configs">
        `;

        topResults.forEach((result, index) => {
            const score = result.score;
            const config = result.config;

            html += `
                <div class="config-result ${index === 0 ? 'best-config' : ''}" onclick="DetectionConfig.applyConfiguration('${config.name}', ${JSON.stringify(config.settings).replace(/"/g, '&quot;')}, ${JSON.stringify(config.regionTypeConfig || {}).replace(/"/g, '&quot;')})">
                    <div class="config-rank">#${index + 1}</div>
                    <div class="config-details">
                        <div class="config-name">${config.name}</div>
                        <div class="config-category">${config.category || 'standard'}</div>
                        <div class="config-scores">
                            Overall: ${(score.overall * 100).toFixed(1)}% | 
                            IoU: ${(score.avgIoU * 100).toFixed(1)}% | 
                            Types: ${(score.typeAccuracy * 100).toFixed(1)}% |
                            Recall: ${(score.regionRecall * 100).toFixed(1)}%
                        </div>
                        <div class="config-params">
                            T: ${config.settings.threshold}, 
                            A: ${config.settings.templateAdherence}, 
                            C: ${config.settings.confidenceThreshold}, 
                            R: ${config.settings.minRegionSize}
                            ${config.regionTypeConfig ? ' + Region Settings' : ''}
                        </div>
                    </div>
                    <div class="apply-config">Apply</div>
                </div>
            `;
        });

        html += `
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #666;">
                    💡 <strong>Results:</strong> Higher scores are better. IoU measures region overlap accuracy, 
                    Types measures correct classification, Recall measures how many ideal regions were found.
                    Click any configuration to apply its settings instantly.
                    ${results.length > 10 ? `<br>📊 Showing top 10 of ${results.length} valid configurations.` : ''}
                </div>
            </div>
        `;

        resultsDiv.innerHTML = html;

        console.log(`📊 ${testInfo.testMode || 'Test'} results stored in window.lastSweepResults`);
        window.lastSweepResults = results;
        window.lastTestInfo = testInfo;
    },

    /**
     * Apply a specific configuration from sweep results
     */
    applyConfiguration: function(configName, settings, regionTypeConfig) {
        console.log(`Applying configuration: ${configName}`, settings);

        // Update current config with the selected settings
        Object.assign(this.currentConfig.global, settings);

        // Update region-specific config if provided
        if (regionTypeConfig) {
            console.log('Applying region-specific configuration:', regionTypeConfig);
            this.currentConfig.regionTypes = JSON.parse(JSON.stringify(regionTypeConfig));
        }

        // Refresh the config panel to show new values
        this.refreshConfigPanel();

        // Run preview if enabled
        if (this.autoRerunEnabled) {
            this.schedulePreviewUpdate();
        }

        this.showPreviewMessage(`Applied configuration: ${configName}${regionTypeConfig ? ' (including region-specific settings)' : ''}`);

        if (window.editor && window.editor.updateStatus) {
            window.editor.updateStatus(`Applied configuration: ${configName}`);
        }
    }
};