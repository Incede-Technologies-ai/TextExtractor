import React, { useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument } from "pdf-lib";

// Load pdf.js worker for rendering
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFCropper = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const selectionRef = useRef(null);
  const containerRef = useRef(null);
  const scale = 4; // Increased scale for HD quality
  const pdfScale = 1.5; // Display scale of the PDF

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(URL.createObjectURL(file));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleMouseDown = (event) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;

    setSelection({ x: startX, y: startY, width: 0, height: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (event) => {
    if (!isSelecting || !selection) return;

    const rect = containerRef.current.getBoundingClientRect();
    const endX = event.clientX - rect.left;
    const endY = event.clientY - rect.top;

    setSelection((prev) => ({
      x: Math.min(prev.x, endX),
      y: Math.min(prev.y, endY),
      width: Math.abs(endX - prev.x),
      height: Math.abs(endY - prev.y),
    }));
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    if (selection?.width > 0 && selection?.height > 0) {
      selectionRef.current = selection;
    }
  };

  const handleExportToPDF = async () => {
    if (!selectionRef.current || !pdfFile) {
      console.error("Selection area or PDF file is missing!");
      return;
    }

    try {
      const loadingTask = pdfjs.getDocument(pdfFile);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Create a hidden canvas to render the PDF in high quality
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      // Adjust selection coordinates for high resolution
      const { x, y, width, height } = selectionRef.current;
      const scaleRatio = scale / pdfScale;

      // Create a cropped canvas
      const croppedCanvas = document.createElement("canvas");
      const croppedContext = croppedCanvas.getContext("2d");

      croppedCanvas.width = width * scaleRatio;
      croppedCanvas.height = height * scaleRatio;

      croppedContext.drawImage(
        canvas,
        x * scaleRatio,
        y * scaleRatio,
        width * scaleRatio,
        height * scaleRatio,
        0,
        0,
        width * scaleRatio,
        height * scaleRatio
      );

      // Convert cropped canvas to high-quality JPEG image
      const croppedImageData = croppedCanvas.toDataURL("image/jpeg", 1.0); // Maximum quality

      // Create a high-quality PDF
      const newPdfDoc = await PDFDocument.create();
      const newPage = newPdfDoc.addPage([width * scaleRatio, height * scaleRatio]);

      // Embed the cropped image in high resolution
      const image = await newPdfDoc.embedJpg(croppedImageData);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: width * scaleRatio,
        height: height * scaleRatio,
      });

      // Save and download the new PDF
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "cropped_hd.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log("Cropped HD-quality PDF saved successfully!");
    } catch (error) {
      console.error("Error cropping PDF:", error);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h2>PDF Cropper (HD Quality)</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      
      {pdfFile && (
        <>
          <div
            ref={containerRef}
            style={{ position: "relative", display: "inline-block", cursor: "crosshair" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Document file={pdfFile} onLoadSuccess={onDocumentLoadSuccess}>
              <Page pageNumber={pageNumber} scale={pdfScale} />
            </Document>

            {selection && (
              <div
                style={{
                  position: "absolute",
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                  border: "2px dashed red",
                  backgroundColor: "rgba(255, 0, 0, 0.2)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          <div style={{ marginTop: "10px" }}>
            <button onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}>
              Prev Page
            </button>
            <span style={{ margin: "0 10px" }}>
              Page {pageNumber} of {numPages}
            </span>
            <button onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}>
              Next Page
            </button>
          </div>

          <button onClick={handleExportToPDF} style={{ marginTop: "10px" }}>
            Export Selected Area to PDF (HD)
          </button>
        </>
      )}
    </div>
  );
};

export default PDFCropper;
