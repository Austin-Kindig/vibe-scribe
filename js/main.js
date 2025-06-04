/**
 * Main application initialization
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the main application
    initializeApp();
});

function initializeApp() {
    try {
        // Check if RegionEditor class is available
        if (typeof RegionEditor === 'undefined') {
            throw new Error('RegionEditor class not found. Check if RegionEditorCore.js loaded properly.');
        }

        // Create the main editor instance
        const editor = new RegionEditor();

        // Make editor globally accessible for onclick handlers and other modules
        window.editor = editor;

        // Log successful initialization
        console.log('OCR Region Editor initialized successfully');

        // Add global error handling
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

    } catch (error) {
        console.error('Failed to initialize OCR Region Editor:', error);
        showInitializationError(error);
    }
}

function handleGlobalError(event) {
    console.error('Global error:', event.error);
    if (window.editor && window.editor.updateStatus) {
        window.editor.updateStatus('An error occurred: ' + event.error.message);
    }
}

function handleUnhandledRejection(event) {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.editor && window.editor.updateStatus) {
        window.editor.updateStatus('Operation failed: ' + event.reason);
    }
}

function showInitializationError(error) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = 'Failed to initialize application: ' + error.message;
        statusEl.style.backgroundColor = '#f8d7da';
        statusEl.style.color = '#721c24';
    }
}

// Development helpers (remove in production)
if (typeof console !== 'undefined') {
    console.log('OCR Region Editor - Modular Version');
    console.log('Available modules:', {
        Utils: typeof Utils !== 'undefined',
        PDFHandler: typeof PDFHandler !== 'undefined',
        ImageProcessor: typeof ImageProcessor !== 'undefined',
        QualityReview: typeof QualityReview !== 'undefined',
        CanvasManager: typeof CanvasManager !== 'undefined',
        RegionEditor: typeof RegionEditor !== 'undefined'
    });
}