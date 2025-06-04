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
                <div style="padding: 20px; text-align: center; background: #f8f9fa; border-radius: 3px; border: 2px dashed #6f42c1;">
                    <div style="font-size: 24px; margin-bottom: 10px;">📦</div>
                    <div style="font-weight: bold; color: #6f42c1;">ZIP Archive</div>
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">${slice.totalSlices} slices</div>
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
 * Show zoom modal for a slice
 */
showZoom(sliceId) {
    const slice = this.getSliceById(sliceId);
    if (!slice) return;

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

        // Prevent body scrolling when modal is open
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
        console.log('Storing slices for review:', results); // Debug log

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
     * Create a slice card element
     */
    createSliceCard(slice) {
        const card = document.createElement('div');
        card.className = 'slice-card';

        const review = this.reviewData[slice.id];

        card.innerHTML = `
            <img src="${slice.url}" alt="${slice.filename}" class="slice-preview" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none; padding: 20px; text-align: center; background: #f8f9fa; border-radius: 3px;">
                Preview not available
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

        return card;
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
                timestamp: this.reviewData[slice.id].timestamp
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