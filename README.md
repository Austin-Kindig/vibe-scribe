# OCR Region Editor for Historical Text Processing

## Project Overview

A web-based tool for processing historical Latin manuscripts and Douay-Rheims English texts. The goal is to convert complex historical documents (PDFs with poor scan quality, archaic language, and complex layouts) into clean, modern English text through a structured OCR and translation pipeline.

## Project Goals

### Primary Objective
Build a utility to process old Latin book PDFs and Douay-Rheims English texts through OCR and translation, converting complex historical documents into clean, modern English text.

### Key Requirements
- **Input**: PDF books (hundreds of pages each, consistent layout within books)
- **Output**: Clean translated text (no need to preserve original formatting)
- **OCR Engine**: Rescribe (specialized for historical texts) + Tesseract fallback
- **Translation**: Local LLM preferred, API possible
- **Interface**: Web-based (PDF upload → text output)
- **Architecture**: Local server setup acceptable, Python or JavaScript

## Current Implementation Status

### ✅ Completed Features

#### 1. Interactive Region Editor
- **PDF Support**: Load multi-page PDFs with page navigation
- **Image Support**: Single image processing capability
- **Region Drawing**: Click and drag to create regions for different content types
- **Region Types**: Left Text, Right Text, Left Margin, Right Margin, Header, Footer, Custom types
- **Region Management**:
    - Resizable regions with 8-point handles
    - Click to select, drag handles to resize
    - Delete and manage regions in sidebar
- **Skew Correction**: Slider-based rotation with visual grid overlay for alignment
- **Templates**: Save/load region layouts for similar pages

#### 2. Image Processing Pipeline
- **Client-side Processing**: No server required - all processing in browser
- **Multi-format Output**: ZIP archives or individual downloads
- **Quality Options**: High (PNG), Medium (JPEG 90%), Low (JPEG 70%)
- **Batch Processing**: Handle multiple pages with progress tracking
- **File Naming**: Organized naming convention: `pdfname_page001_regiontype_01.png`

#### 3. Quality Review System
- **Visual Review**: Grid layout showing all processed image slices
- **Quality Control**: Approve/Flag/Edit functionality for each slice
- **Issue Tracking**: Flag slices with specific reasons (poor OCR quality, boundary issues)
- **Workflow Integration**: "Edit" button jumps back to region editor for specific page/region
- **Reporting**: Export flagged issues as JSON for process improvement

#### 4. Modular Architecture
- **Clean Separation**: Split into logical modules for maintainability
- **Error Handling**: Defensive programming throughout
- **Browser Compatibility**: Works with modern browsers, uses PDF.js for PDF processing

### 📁 Current File Structure
```
ocr-region-editor/
├── index.html                  # Main HTML structure
├── README.md                   # Project documentation
├── css/
│   └── styles.css              # All CSS styles 
├── js/
│   ├── main.js                 # App initialization
│   ├── utils.js                # Utility functions
│   ├── PDFHandler.js           # PDF loading/rendering
│   ├── ImageProcessor.js       # Image processing/cropping
│   ├── QualityReview.js        # Review system
│   ├── CanvasManager.js        # Canvas drawing/interaction
│   └── RegionEditorCore.js     # Main editor class
```

## Technical Challenges Identified

### 1. Complex Document Layouts
- **Two-column layouts** with varying column boundaries
- **Margin annotations** that need to align with main text
- **Headers, footers, and page numbers** requiring separate handling
- **Inconsistent spacing** and formatting across pages

### 2. Scan Quality Issues
- **Skewed/tilted pages** from book binding during scanning
- **Poor image quality** in historical documents
- **Faded text** and scanning artifacts
- **Variable lighting** and shadows

### 3. OCR Challenges
- **Latin abbreviations** and archaic language forms
- **Historical typography** with ligatures (æ, œ, etc.)
- **Gothic/blackletter fonts** in some manuscripts
- **Margin notes** in different scripts/hands

### 4. Layout Detection
- **Current tools like Rescribe struggle** with complex page layouts
- **Manual region definition** currently required for each page type
- **Template system** helps but needs refinement for edge cases

## Development History & Decisions

### Key Technical Decisions Made
1. **Client-side Processing**: Chose browser-based processing over server to avoid backend complexity
2. **Modular Architecture**: Split monolithic code into logical modules for maintainability
3. **Interactive Region Definition**: Manual region drawing with templates rather than automatic detection
4. **Quality Control Integration**: Built-in review system to catch and fix issues in the pipeline
5. **PDF.js Integration**: Using PDF.js v3.11.174 for reliable PDF rendering

### Challenges Overcome
1. **PDF.js Worker Issues**: Resolved "fake worker" warnings by using correct CDN versions
2. **Grid Alignment**: Fixed grid overlay to stay straight during skew adjustment
3. **Region Resize**: Implemented 8-point resize handles for precise region adjustment
4. **Class Structure**: Resolved function scoping issues when moving to modular architecture
5. **Progress Tracking**: Added visual progress bars for long processing operations

## Current Issues & Limitations

### 🐛 Known Issues
1. **ZIP File Review**: Quality review shows placeholder for ZIP files rather than individual slice previews
2. **Template Refinement**: Templates need better handling of varying page dimensions
3. **Memory Usage**: Large PDFs with many regions can consume significant browser memory
4. **Skew Detection**: Manual skew adjustment required - no automatic detection yet

### 🔧 Current Limitations
1. **No OCR Integration**: Image slices are generated but not yet passed to Rescribe/Tesseract
2. **No Translation Pipeline**: No LLM integration for Latin→English translation
3. **No Automatic Layout Detection**: All region definition is manual
4. **No Batch Document Processing**: Each PDF must be processed individually

## Next Steps & TODOs

### 🎯 Immediate Priorities (Next Development Phase)

#### 1. OCR Integration
- [ ] **Rescribe Integration**: Connect image slices to Rescribe OCR engine
- [ ] **Tesseract Fallback**: Implement fallback OCR when Rescribe fails
- [ ] **OCR Quality Assessment**: Automatically flag low-confidence OCR results
- [ ] **Text Output Management**: Structure OCR results by region type and page

#### 2. Translation Pipeline
- [ ] **Local LLM Integration**: Connect to local language model for translation
- [ ] **Translation Quality Control**: Review system for translation accuracy
- [ ] **Context Preservation**: Maintain document structure through translation
- [ ] **Batch Translation**: Process multiple text segments efficiently

#### 3. Enhanced Automation
- [ ] **Auto-skew Detection**: Implement automatic page rotation detection
- [ ] **Layout Template Learning**: Improve template system with machine learning
- [ ] **Region Suggestion**: AI-assisted region boundary suggestions
- [ ] **Batch Processing**: Multi-document processing capabilities

### 🚀 Medium-term Goals

#### 1. Advanced Features
- [ ] **Text Correction Interface**: Manual correction of OCR errors before translation
- [ ] **Dictionary Integration**: Latin dictionary lookup for difficult terms
- [ ] **Annotation System**: Mark and track editorial decisions
- [ ] **Export Formats**: Multiple output formats (plain text, structured JSON, etc.)

#### 2. Performance & Scalability
- [ ] **Memory Optimization**: Better handling of large documents
- [ ] **Progress Persistence**: Save progress and resume processing
- [ ] **Cloud Storage Integration**: Save/load documents from cloud services
- [ ] **Parallel Processing**: Multi-threaded OCR and translation

#### 3. User Experience
- [ ] **Keyboard Shortcuts**: Speed up region definition workflow
- [ ] **Undo/Redo System**: Better editing capabilities
- [ ] **Region Auto-snap**: Snap regions to text boundaries
- [ ] **Zoom/Pan Canvas**: Better navigation for large documents

### 🔮 Long-term Vision

1. **Full Automation**: Minimal manual intervention required
2. **Multi-language Support**: Extend beyond Latin to other historical languages
3. **Collaborative Features**: Multiple users working on same document
4. **Training Data Generation**: Export annotated data for ML model training
5. **Integration APIs**: Connect with digital humanities workflows

## Technical Architecture

### Current Stack
- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **PDF Processing**: PDF.js v3.11.174
- **Image Processing**: Canvas API, JSZip for archives
- **Storage**: LocalStorage for templates, in-memory for processing

### External Dependencies
- **PDF.js**: PDF rendering and page extraction
- **JSZip**: Archive creation for batch downloads
- **Rescribe** (planned): Specialized historical OCR
- **Tesseract** (planned): Fallback OCR engine

### Data Flow
```
PDF Upload → Page Rendering → Region Definition → Image Slicing → 
[OCR Processing] → [Translation] → Final Text Output
```

## Development Setup

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Local web server (optional, can run from file://)
- For OCR integration: Rescribe and/or Tesseract installations

### Quick Start
1. Clone/download the project files
2. Open `index.html` in a web browser
3. Upload a PDF or image file
4. Draw regions around different content areas
5. Process the document to generate image slices
6. Review quality in the Quality Review tab

### Development Guidelines
- Each module should be self-contained with clear interfaces
- Add defensive programming (null checks) for DOM operations
- Use the Utils module for shared functionality
- Follow the established naming conventions for files and functions
- Test with both single images and multi-page PDFs

## Sample Documents & Test Cases

### Test Document Types
1. **Two-column Latin manuscripts** - Primary use case
2. **Single-column Douay-Rheims text** - Secondary use case
3. **Documents with extensive margin notes** - Complex layout testing
4. **Poor quality scans** - OCR challenge testing
5. **Skewed/rotated pages** - Skew correction testing

### Validation Criteria
- Region boundaries accurately capture text without overlap
- OCR quality sufficient for translation (when implemented)
- Processing time reasonable for typical document sizes
- Quality review workflow catches problematic regions
- Output files properly organized and named

## Contributing

When continuing development:

1. **Understand the modular structure** - each JS file has specific responsibilities
2. **Test across different document types** - the tool should handle various layouts
3. **Maintain the quality review workflow** - this is crucial for catching issues
4. **Consider memory usage** - browser-based processing has limitations
5. **Plan for OCR integration** - the current pipeline generates OCR-ready image slices

## Project Context

This tool addresses a real need in digital humanities for processing historical texts. The combination of interactive region definition, quality control workflows, and modular architecture makes it suitable for:

- **Academic researchers** processing historical manuscripts
- **Digital humanities projects** requiring OCR of complex layouts
- **Library digitization efforts** with quality control requirements
- **Translation projects** needing structured text extraction

The focus on Latin texts and Douay-Rheims English reflects specific research needs, but the architecture is generalizable to other historical text processing workflows.