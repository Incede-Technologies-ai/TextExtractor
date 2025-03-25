import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import { saveAs } from 'file-saver';

// PDF.js Worker setup
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js`;

export default function App() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [error, setError] = useState('');
  const overlayRef = useRef(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfUrl(e.target.result);
        setError('');
      };
      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setError('');
  };

  const handleMouseDown = (event) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    setSelectionBox({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: 0,
      height: 0,
    });
    setIsSelecting(true);
  };

  const handleMouseMove = (event) => {
    if (!isSelecting || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    setSelectionBox((prev) => ({
      ...prev,
      width: Math.abs(endX - prev.x),
      height: Math.abs(endY - prev.y),
    }));
  };

  const handleMouseUp = async () => {
    setIsSelecting(false);
    if (!overlayRef.current || !pdfUrl) return;

    const { x, y, width, height } = selectionBox;
    if (width > 10 && height > 10) {
      try {
        const pdfDoc = await pdfjs.getDocument(pdfUrl).promise;
        const page = await pdfDoc.getPage(1);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });

        // Convert selection to PDF coordinates
        const pdfX = (x / overlayRef.current.clientWidth) * viewport.width;
        const pdfY = ((y + height) / overlayRef.current.clientHeight) * viewport.height;
        const pdfWidth = (width / overlayRef.current.clientWidth) * viewport.width;
        const pdfHeight = (height / overlayRef.current.clientHeight) * viewport.height;

        // Extract text within the selected area
        const extractedText = textContent.items
          .filter((item) => {
            const [tx, ty] = item.transform.slice(4, 6); // Get text coordinates
            return tx >= pdfX && tx <= pdfX + pdfWidth && ty >= pdfY && ty <= pdfY + pdfHeight;
          })
          .map((item) => item.str)
          .join(' ');

        setSelectedText(extractedText || 'No text found in the selected area');
      } catch (error) {
        setError('Error extracting text from the selected area.');
      }
    }
  };

  const handleDownloadWord = () => {
    if (!selectedText) return;
    const blob = new Blob([selectedText], { type: 'application/msword' });
    saveAs(blob, 'extracted_text.doc');
  };

  return (
    <div className="App">
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      {error && <div className="error">{error}</div>}

      <div className="container">
        <div className="pdf-container">
          <h3>PDF Preview:</h3>
          {pdfUrl && (
            <div
              ref={overlayRef}
              className="overlay"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
            >
              <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                <Page pageNumber={1} />
              </Document>
              {isSelecting && (
                <div
                  className="selection-box"
                  style={{
                    left: `${selectionBox.x}px`,
                    top: `${selectionBox.y}px`,
                    width: `${selectionBox.width}px`,
                    height: `${selectionBox.height}px`,
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="selection-container">
          <h3>Extracted Text:</h3>
          <p>{selectedText || 'No text selected'}</p>
          <button onClick={handleDownloadWord} disabled={!selectedText}>
            Download as Word
          </button>
        </div>
      </div>

      {/* Add some styling */}
      <style>{`
        .container {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }
        .pdf-container {
          width: 60%;
          position: relative;
          border: 1px solid #ddd;
          padding: 10px;
          background: #fff;
        }
        .overlay {
          position: relative;
          width: 100%;
          height: auto;
        }
        .selection-box {
          position: absolute;
          background: rgba(0, 0, 255, 0.3);
          border: 2px dashed blue;
          pointer-events: none;
        }
        .selection-container {
          width: 35%;
          padding: 10px;
          background: #f9f9f9;
          border: 1px solid #ddd;
        }
        button {
          background: blue;
          color: white;
          padding: 8px 12px;
          border: none;
          cursor: pointer;
          margin-top: 10px;
        }
        button:disabled {
          background: gray;
          cursor: not-allowed;
        }
        .error {
          color: red;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}
