/**
 * Quality Review - Manages slice review and quality control
 */

window.QualityReview = {
    // Internal state
    reviewSlices: [],
    reviewData: {},
    currentZoomedSlice: null,

    /**
     * Initialize quality review system
     */
    init() {
        this.setupEventListeners();
        this.setupZoomModal();
    },

    /**
     * Setup event listeners for review controls
     */
    setupEventListeners() {
        Utils.addSafeEventListener('reviewFilter', 'change', () => this.filterSlices());
        Utils.addSafeEventListener('reviewSort', 'change', () => this.sortSlices());
        Utils.addSafeEventListener('exportFlagged', 'click', () => this.exportFlaggedIssues());
        Utils.addSafeEventListener('clearReview', 'click', () => this.clearReview());
    },

    /**
     * Setup zoom modal functionality
     */
    setupZoomModal() {
        const modal = document.getElementById('zoomModal');
        const closeBtn = document.getElementById('closeZoom');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeZoom());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeZoom();
                }
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.style.display === 'block') {
                this.closeZoom();
            }
        });
    },

    /**
     * Store processed slices for review
     */
    storeSlicesForReview(results) {
        console.log('Storing slices for review:', results);

        this.reviewSlices = [];
        this.reviewData = {};

        if (results.files && results.files.length > 0) {
            // Individual files
            console.log('Processing individual files:', results.files.length);
            results.files.forEach((file, index) => {
                const sliceId = `slice_${index}`;
                this.reviewSlices.push({
                    id: sliceId,
                    filename: file.filename,
                    url: file.url,
                    type: file.type,
                    page: file.page || 1
                });
                this.reviewData[sliceId] = {
                    status: 'unreviewed',
                    reason: '',
                    timestamp: null
                };
            });
        } else if (results.zipUrl) {
            // ZIP file - create a special review entry
            console.log('Processing ZIP file');
            const zipId = 'zip_archive';
            this.reviewSlices.push({
                id: zipId,
                filename: results.zipFilename,
                url: results.zipUrl,
                type: 'archive',
                page: 'multiple',
                isZip: true,
                totalSlices: results.total_slices
            });
            this.reviewData[zipId] = {
                status: 'unreviewed',
                reason: 'ZIP archive containing ' + results.total_slices + ' slices',
                timestamp: null
            };
        } else {
            console.warn('No files or ZIP found in results:', results);
        }

        console.log('Review slices stored:', this.reviewSlices.length);
        this.updateStats();
    },

    /**
     * Create a slice card element
     */
    createSliceCard(slice) {
        const card = document.createElement('div');
        card.className = 'slice-card';

        if (slice.isZip) {
            card.classList.add('zip-archive');
        }

        const review = this.reviewData[slice.id];

        if (slice.isZip) {
            // Special ZIP archive card
            card.innerHTML = `
                <div style="padding: 20px; text-align: center; background: #f8f9fa; border-radius: 3px; border: 2px dashed #6f42c1; cursor: pointer;" 
                     onclick="QualityReview.showZipPreview('${slice.id}')">
                    <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
                    <div style="font-weight: bold; color: #6f42c1;">ZIP Archive</div>
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">${slice.totalSlices} slices</div>
                    <div style="font-size: 10px; color: #999; margin-top: 5px;">Click to preview</div>
                </div>
                
                <div class="slice-info">
                    <div class="slice-filename">${slice.filename}</div>
                    <div class="slice-details">
                        Archive | ${slice.totalSlices} files
                    </div>
                    <div class="slice-status status-${review.status}">
                        ${review.status.toUpperCase()}
                    </div>
                    ${review.reason ? `<div class="flag-reason">${review.reason}</div>` : ''}
                </div>
                
                <div class="slice-actions">
                    <a href="${slice.url}" download="${slice.filename}" class="btn-approve" style="text-decoration: none;">
                        ⬇ Download ZIP
                    </a>
                    <button class="btn-flag" onclick="QualityReview.flagSlice('${slice.id}')">
                        ⚠ Flag
                    </button>
                    <button class="btn-approve" onclick="QualityReview.approveSlice('${slice.id}')">
                        ✓ Approve Archive
                    </button>
                </div>
            `;
        } else {
            // Regular image slice card
            card.innerHTML = `
                <img src="${slice.url}" alt="${slice.filename}" class="slice-preview clickable" 
                     onclick="QualityReview.showZoom('${slice.id}')"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none; padding: 20px; text-align: center; background: #f8f9fa; border-radius: 3px;">
                    Preview not available<br>
                    <button class="btn-small" onclick="QualityReview.showZoom('${slice.id}')">🔍 Try Zoom</button>
                </div>
                
                <div class="slice-info">
                    <div class="slice-filename">${slice.filename}</div>
                    <div class="slice-details">
                        Type: ${slice.type} | Page: ${slice.page}
                    </div>
                    <div class="slice-status status-${review.status}">
                        ${review.status.toUpperCase()}
                    </div>
                    ${review.reason ? `<div class="flag-reason">${review.reason}</div>` : ''}
                </div>
                
                <div class="slice-actions">
                    <button class="btn-approve" onclick="QualityReview.approveSlice('${slice.id}')">
                        ✓ Approve
                    </button>
                    <button class="btn-flag" onclick="QualityReview.flagSlice('${slice.id}')">
                        ⚠ Flag
                    </button>
                    <button class="btn-edit" onclick="QualityReview.editSliceRegion('${slice.id}')">
                        ✏ Edit
                    </button>
                </div>
            `;
        }

        return card;
    },

    /**
     * Show ZIP file contents preview by extracting and displaying images
     */
    async showZipPreview(sliceId) {
        const slice = this.getSliceById(sliceId);
        if (!slice || !slice.isZip) return;

        try {
            // Show loading modal first
            this.showZipLoadingModal(slice);

            // Load JSZip and extract the ZIP
            const JSZip = await Utils.loadJSZip();
            const response = await fetch(slice.url);
            const zipBlob = await response.blob();
            const zip = await JSZip.loadAsync(zipBlob);

            // Extract image files
            const imageFiles = [];
            for (const [filename, file] of Object.entries(zip.files)) {
                if (!file.dir && this.isImageFile(filename)) {
                    const blob = await file.async('blob');
                    const url = URL.createObjectURL(blob);
                    imageFiles.push({
                        filename: filename,
                        url: url,
                        type: this.extractRegionType(filename),
                        page: this.extractPageNumber(filename)
                    });
                }
            }

            // Sort by page and filename
            imageFiles.sort((a, b) => {
                if (a.page !== b.page) return a.page - b.page;
                return a.filename.localeCompare(b.filename);
            });

            // Show the extracted images in review format
            this.showZipImagesModal(slice, imageFiles);

        } catch (error) {
            console.error('Error extracting ZIP:', error);
            this.showZipErrorModal(slice, error.message);
        }
    },

    /**
     * Show loading modal while extracting ZIP
     */
    showZipLoadingModal(slice) {
        const existingModal = document.getElementById('zipPreviewModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'zipPreviewModal';
        modal.className = 'zoom-modal';
        modal.style.display = 'block';

        modal.innerHTML = `
            <span class="close-zoom" onclick="document.getElementById('zipPreviewModal').remove(); document.body.style.overflow = 'auto';">&times;</span>
            <div class="zoom-modal-content">
                <div style="background: white; padding: 40px; border-radius: 8px; text-align: center;">
                    <h3>Extracting ZIP Archive...</h3>
                    <div style="margin: 20px 0;">
                        <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007acc; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    </div>
                    <p>Extracting and processing ${slice.totalSlices} images from ${slice.filename}</p>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    },

    /**
     * Show ZIP images in a reviewable grid
     */
    showZipImagesModal(slice, imageFiles) {
        const existingModal = document.getElementById('zipPreviewModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'zipPreviewModal';
        modal.className = 'zoom-modal';
        modal.style.display = 'block';

        const review = this.reviewData[slice.id];

        modal.innerHTML = `
            <span class="close-zoom" onclick="QualityReview.closeZipPreview()">&times;</span>
            <div class="zoom-modal-content" style="width: 95%; max-width: none; height: 90vh; overflow-y: auto;">
                <div style="background: white; padding: 20px; border-radius: 8px; height: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #ddd;">
                        <div>
                            <h3 style="margin: 0;">ZIP Archive: ${slice.filename}</h3>
                            <p style="margin: 5px 0 0 0; color: #666;">
                                ${imageFiles.length} images extracted | Status: ${review.status.toUpperCase()}
                            </p>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <a href="${slice.url}" download="${slice.filename}" class="btn-approve" style="text-decoration: none; padding: 8px 16px;">
                                ⬇ Download ZIP
                            </a>
                            <button class="btn-approve" onclick="QualityReview.approveSlice('${slice.id}'); QualityReview.closeZipPreview();">
                                ✓ Approve All
                            </button>
                            <button class="btn-flag" onclick="QualityReview.flagSlice('${slice.id}'); QualityReview.closeZipPreview();">
                                ⚠ Flag Archive
                            </button>
                        </div>
                    </div>
                    <div id="zipImageGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; max-height: calc(90vh - 160px); overflow-y: auto;">
                        ${this.generateZipImageCards(imageFiles, slice.id)}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeZipPreview();
            }
        });
    },

    /**
     * Generate image cards for ZIP contents
     */
    generateZipImageCards(imageFiles, zipSliceId) {
        return imageFiles.map((file, index) => `
            <div class="slice-card" style="background: white; border: 1px solid #ddd;">
                <img src="${file.url}" alt="${file.filename}" class="slice-preview clickable" 
                     onclick="QualityReview.showZipImageZoom('${file.url}', '${file.filename}', '${file.type}', '${file.page}')"
                     style="width: 100%; max-height: 150px; object-fit: contain; cursor: pointer;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display: none; padding: 20px; text-align: center; background: #f8f9fa;">
                    Failed to load image
                </div>
                
                <div class="slice-info" style="padding: 10px;">
                    <div class="slice-filename" style="font-weight: bold; font-size: 11px; word-break: break-word;">
                        ${file.filename}
                    </div>
                    <div class="slice-details" style="font-size: 10px; color: #666; margin-top: 3px;">
                        Type: ${file.type} | Page: ${file.page}
                    </div>
                </div>
            </div>
        `).join('');
    },

    /**
     * Show individual image from ZIP in zoom view
     */
    showZipImageZoom(imageUrl, filename, type, page) {
        // Store current ZIP modal state
        const zipModal = document.getElementById('zipPreviewModal');
        if (zipModal) {
            zipModal.style.display = 'none';
        }

        // Show zoom modal
        const zoomModal = document.getElementById('zoomModal');
        const image = document.getElementById('zoomImage');
        const info = document.getElementById('zoomInfo');

        if (zoomModal && image && info) {
            image.src = imageUrl;
            image.alt = filename;

            info.innerHTML = `
                <strong>${filename}</strong><br>
                Type: ${type} | Page: ${page} | From ZIP Archive
            `;

            zoomModal.style.display = 'block';

            // Override zoom close to return to ZIP preview
            const closeBtn = document.getElementById('closeZoom');
            closeBtn.onclick = () => {
                zoomModal.style.display = 'none';
                if (zipModal) {
                    zipModal.style.display = 'block';
                }
            };
        }
    },

    /**
     * Close ZIP preview modal and cleanup
     */
    closeZipPreview() {
        const modal = document.getElementById('zipPreviewModal');
        if (modal) {
            // Cleanup any object URLs to prevent memory leaks
            const images = modal.querySelectorAll('img[src^="blob:"]');
            images.forEach(img => {
                URL.revokeObjectURL(img.src);
            });

            modal.remove();
            document.body.style.overflow = 'auto';
        }
    },

    /**
     * Show error modal for ZIP extraction failures
     */
    showZipErrorModal(slice, errorMessage) {
        const existingModal = document.getElementById('zipPreviewModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'zipPreviewModal';
        modal.className = 'zoom-modal';
        modal.style.display = 'block';

        modal.innerHTML = `
            <span class="close-zoom" onclick="document.getElementById('zipPreviewModal').remove(); document.body.style.overflow = 'auto';">&times;</span>
            <div class="zoom-modal-content">
                <div style="background: white; padding: 30px; border-radius: 8px; text-align: center; max-width: 500px;">
                    <h3 style="color: #dc3545;">ZIP Extraction Error</h3>
                    <p style="margin: 15px 0;">Failed to extract images from ${slice.filename}</p>
                    <p style="font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">
                        ${errorMessage}
                    </p>
                    <div style="margin-top: 20px;">
                        <a href="${slice.url}" download="${slice.filename}" class="btn-approve" style="text-decoration: none; padding: 8px 16px;">
                            ⬇ Download ZIP Manually
                        </a>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    },

    /**
     * Check if filename is an image file
     */
    isImageFile(filename) {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return imageExtensions.includes(ext);
    },

    /**
     * Extract region type from filename
     */
    extractRegionType(filename) {
        const typeMatch = filename.match(/_([^_]+)_\d+\.(png|jpg|jpeg)$/i);
        return typeMatch ? typeMatch[1] : 'unknown';
    },

    /**
     * Extract page number from filename
     */
    extractPageNumber(filename) {
        const pageMatch = filename.match(/page(\d+)/i);
        return pageMatch ? parseInt(pageMatch[1]) : 1;
    },

    /**
     * Show zoom modal for a slice
     */
    showZoom(sliceId) {
        const slice = this.getSliceById(sliceId);
        if (!slice || slice.isZip) {
            if (slice && slice.isZip) {
                this.showZipPreview(sliceId);
            }
            return;
        }

        this.currentZoomedSlice = slice;

        const modal = document.getElementById('zoomModal');
        const image = document.getElementById('zoomImage');
        const info = document.getElementById('zoomInfo');

        if (modal && image && info) {
            image.src = slice.url;
            image.alt = slice.filename;

            const review = this.reviewData[slice.id];
            info.innerHTML = `
                <strong>${slice.filename}</strong><br>
                Type: ${slice.type} | Page: ${slice.page} | Status: ${review.status.toUpperCase()}
            `;

            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Close zoom modal
     */
    closeZoom() {
        const modal = document.getElementById('zoomModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        this.currentZoomedSlice = null;
    },

    /**
     * Approve currently zoomed slice
     */
    approveCurrentZoomedSlice() {
        if (this.currentZoomedSlice) {
            this.approveSlice(this.currentZoomedSlice.id);
            this.closeZoom();
        }
    },

    /**
     * Flag currently zoomed slice
     */
    flagCurrentZoomedSlice() {
        if (this.currentZoomedSlice) {
            this.flagSlice(this.currentZoomedSlice.id);
            this.closeZoom();
        }
    },

    /**
     * Edit currently zoomed slice region
     */
    editCurrentZoomedSlice() {
        if (this.currentZoomedSlice) {
            this.editSliceRegion(this.currentZoomedSlice.id);
            this.closeZoom();
        }
    },

    /**
     * Approve a slice
     */
    approveSlice(sliceId) {
        this.reviewData[sliceId] = {
            status: 'approved',
            reason: '',
            timestamp: new Date().toISOString()
        };
        this.updateStats();

        const slice = this.getSliceById(sliceId);
        if (window.editor && window.editor.updateStatus) {
            window.editor.updateStatus(`Slice approved: ${slice.filename}`);
        }
    },

    /**
     * Flag a slice with reason
     */
    flagSlice(sliceId) {
        const slice = this.getSliceById(sliceId);
        const reason = prompt(`Flag reason for ${slice.filename}:`, 'Poor OCR quality / Region boundary issues');

        if (reason !== null) {
            this.reviewData[sliceId] = {
                status: 'flagged',
                reason: reason || 'No reason provided',
                timestamp: new Date().toISOString()
            };
            this.updateStats();

            if (window.editor && window.editor.updateStatus) {
                window.editor.updateStatus(`Slice flagged: ${slice.filename}`);
            }
        }
    },

    /**
     * Edit slice region - navigate back to editor
     */
    editSliceRegion(sliceId) {
        const slice = this.getSliceById(sliceId);

        // Switch to editor tab
        if (window.editor && window.editor.switchTab) {
            window.editor.switchTab('editor');

            // Navigate to the relevant page if it's a multi-page document
            if (slice.page && slice.page !== 'multiple' && window.editor.pdfDoc) {
                const targetPage = parseInt(slice.page);
                if (targetPage !== window.editor.currentPage) {
                    window.editor.savePageRegions();
                    window.editor.currentPage = targetPage;
                    window.editor.updatePageInfo();
                    window.editor.renderPage(window.editor.currentPage);
                }
            }

            if (window.editor.updateStatus) {
                window.editor.updateStatus(`Switched to editor for page ${slice.page} - adjust regions for ${slice.type}`);
            }
        }
    },

    /**
     * Update review statistics display
     */
    updateStats() {
        const statsEl = document.getElementById('reviewStats');
        if (!statsEl) return;

        if (this.reviewSlices.length === 0) {
            statsEl.textContent = 'No slices to review';
            this.renderGrid();
            return;
        }

        const total = this.reviewSlices.length;
        const approved = Object.values(this.reviewData).filter(r => r.status === 'approved').length;
        const flagged = Object.values(this.reviewData).filter(r => r.status === 'flagged').length;
        const unreviewed = total - approved - flagged;

        statsEl.innerHTML = `
            Total: ${total} | 
            <span style="color: #28a745;">Approved: ${approved}</span> | 
            <span style="color: #dc3545;">Flagged: ${flagged}</span> | 
            <span style="color: #6c757d;">Unreviewed: ${unreviewed}</span>
        `;

        this.renderGrid();
    },

    /**
     * Render the review grid
     */
    renderGrid() {
        const gridEl = document.getElementById('reviewGrid');
        if (!gridEl) return;

        if (this.reviewSlices.length === 0) {
            gridEl.innerHTML = '<div class="no-slices-message">Process a document in the Image Processing tab to review slices here.</div>';
            return;
        }

        const filteredSlices = this.getFilteredSlices();
        const sortedSlices = this.getSortedSlices(filteredSlices);

        gridEl.innerHTML = '';

        sortedSlices.forEach(slice => {
            const card = this.createSliceCard(slice);
            gridEl.appendChild(card);
        });
    },

    /**
     * Get filtered slices based on current filter
     */
    getFilteredSlices() {
        const filterEl = document.getElementById('reviewFilter');
        const filter = filterEl ? filterEl.value : 'all';

        return this.reviewSlices.filter(slice => {
            const review = this.reviewData[slice.id];
            switch (filter) {
                case 'flagged':
                    return review.status === 'flagged';
                case 'approved':
                    return review.status === 'approved';
                case 'unreviewed':
                    return review.status === 'unreviewed';
                default:
                    return true;
            }
        });
    },

    /**
     * Get sorted slices based on current sort option
     */
    getSortedSlices(slices) {
        const sortEl = document.getElementById('reviewSort');
        const sort = sortEl ? sortEl.value : 'page';

        return [...slices].sort((a, b) => {
            switch (sort) {
                case 'type':
                    return a.type.localeCompare(b.type);
                case 'status':
                    return this.reviewData[a.id].status.localeCompare(this.reviewData[b.id].status);
                case 'page':
                default:
                    return (a.page || 0) - (b.page || 0);
            }
        });
    },

    /**
     * Get slice by ID
     */
    getSliceById(sliceId) {
        return this.reviewSlices.find(slice => slice.id === sliceId);
    },

    /**
     * Filter slices (event handler)
     */
    filterSlices() {
        this.renderGrid();
    },

    /**
     * Sort slices (event handler)
     */
    sortSlices() {
        this.renderGrid();
    },

    /**
     * Export flagged issues as JSON report
     */
    exportFlaggedIssues() {
        const flaggedSlices = this.reviewSlices.filter(slice =>
            this.reviewData[slice.id].status === 'flagged'
        );

        if (flaggedSlices.length === 0) {
            if (window.editor && window.editor.updateStatus) {
                window.editor.updateStatus('No flagged issues to export');
            }
            return;
        }

        const report = {
            document: (window.editor && window.editor.currentFilename) || 'Unknown',
            export_date: new Date().toISOString(),
            flagged_issues: flaggedSlices.map(slice => ({
                filename: slice.filename,
                type: slice.type,
                page: slice.page,
                status: this.reviewData[slice.id].status,
                reason: this.reviewData[slice.id].reason,
                timestamp: this.reviewData[slice.id].timestamp,
                isZip: slice.isZip || false
            }))
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const filename = `flagged_issues_${Utils.sanitizeFilename((window.editor && window.editor.currentFilename) || 'document')}.json`;
        Utils.downloadBlob(blob, filename);

        if (window.editor && window.editor.updateStatus) {
            window.editor.updateStatus(`Exported ${flaggedSlices.length} flagged issues`);
        }
    },

    /**
     * Clear all review data
     */
    clearReview() {
        if (confirm('Clear all review data? This cannot be undone.')) {
            this.reviewSlices = [];
            this.reviewData = {};
            this.updateStats();

            if (window.editor && window.editor.updateStatus) {
                window.editor.updateStatus('Review data cleared');
            }
        }
    },

    /**
     * Get review statistics
     */
    getStats() {
        const total = this.reviewSlices.length;
        if (total === 0) {
            return { total: 0, approved: 0, flagged: 0, unreviewed: 0 };
        }

        const approved = Object.values(this.reviewData).filter(r => r.status === 'approved').length;
        const flagged = Object.values(this.reviewData).filter(r => r.status === 'flagged').length;
        const unreviewed = total - approved - flagged;

        return { total, approved, flagged, unreviewed };
    }
};