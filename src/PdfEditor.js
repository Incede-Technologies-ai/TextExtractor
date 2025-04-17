import React, { useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument } from "pdf-lib";
import { ClipLoader } from "react-spinners"; // Install this using npm install react-spinners

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfEditor = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [apiResponse, setApiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [croppedImageData, setCroppedImageData] = useState(null);
  const selectionRef = useRef(null);
  const containerRef = useRef(null);
  const scale = 4;
  const pdfScale = 1.5;
  const downloadPath = "C:/Users/user/Downloads/1234.pdf";

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

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const { x, y, width, height } = selectionRef.current;
      const scaleRatio = scale / pdfScale;

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

      const croppedDataURL = croppedCanvas.toDataURL("image/jpeg", 1.0);
      setCroppedImageData(croppedDataURL);

      const newPdfDoc = await PDFDocument.create();
      const newPage = newPdfDoc.addPage([width * scaleRatio, height * scaleRatio]);
      const image = await newPdfDoc.embedJpg(croppedDataURL);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: width * scaleRatio,
        height: height * scaleRatio,
      });

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = downloadPath.split("/").pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      console.log("Cropped HD-quality PDF saved as 1234.pdf");

      setTimeout(() => fetchExtractedText(downloadPath), 2000);
    } catch (error) {
      console.error("Error cropping PDF:", error);
    }
  };
  const fetchExtractedText = async (downloadPath) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8080/extract/text?pdfPath=${encodeURIComponent(downloadPath)}`
      );
      if (!response.ok) throw new Error("Failed to extract text from PDF");
      const data = await response.text();
      setApiResponse(data);
    } catch (error) {
      console.error("Error fetching extracted text:", error);
      setApiResponse("Error fetching extracted text.");
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <div style={{ textAlign: "center", marginTop: "20px", backgroundColor: "#f0f8ff", padding: "20px", borderRadius: "10px" }}>
      <h2 style={{ color: "#4682b4" }}>PDF Cropper (HD Quality)</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ marginBottom: "10px" }} />

      {pdfFile && (
        <>
          <div
            ref={containerRef}
            style={{
              position: "relative",
              display: "inline-block",
              cursor: "crosshair",
              border: "1px solid #4682b4",
              borderRadius: "5px",
              padding: "10px",
              backgroundColor: "#ffffff",
            }}
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
            <button
              onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
              style={{
                margin: "5px",
                padding: "10px 15px",
                borderRadius: "5px",
                backgroundColor: "#4682b4",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Prev Page
            </button>
            <span style={{ margin: "0 10px" }}>
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
              style={{
                margin: "5px",
                padding: "10px 15px",
                borderRadius: "5px",
                backgroundColor: "#4682b4",
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Next Page
            </button>
          </div>

          <button
            onClick={handleExportToPDF}
            style={{
              marginTop: "10px",
              padding: "10px 20px",
              borderRadius: "5px",
              backgroundColor: "#32cd32",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Convert To Text
          </button>

          {isLoading && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 9999,
              }}
            >
              <ClipLoader size={60} color={"#ffffff"} loading={true} />
            </div>
          )}

          {croppedImageData && (
            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <h3>Extracted Image:</h3>
              <img
                src={croppedImageData}
                alt="Extracted area"
                style={{ maxWidth: "100%", border: "1px solid #ccc" }}
              />
            </div>
          )}

          {/* Display Extracted Text */}
          {apiResponse && (
            <div style={{ marginTop: "20px", padding: "10px", border: "1px solid #ccc" }}>
              <h3>Extracted Text:</h3>
              <pre style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>{apiResponse}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PdfEditor;