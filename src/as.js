import React, { useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument } from "pdf-lib";
import { ClipLoader } from "react-spinners";
import workerSrc from "pdfjs-dist/build/pdf.worker.entry";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const PdfEditor = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [apiResponse, setApiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [croppedImageData, setCroppedImageData] = useState(null);
  const containerRef = useRef(null);
  const scale = 4;

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setSelection({ startX, startY, endX: startX, endY: startY });
    setIsSelecting(true);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting || !selection || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    setSelection((prev) => ({ ...prev, endX, endY }));
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    processSelection();
  };

  const processSelection = async () => {
    if (!selection || !pdfFile) return;

    const canvas = containerRef.current.querySelector("canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const { startX, startY, endX, endY } = selection;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    const cropped = ctx.getImageData(x, y, width, height);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.putImageData(cropped, 0, 0);

    const imageDataUrl = tempCanvas.toDataURL("image/png");
    setCroppedImageData(imageDataUrl);

    try {
      setIsLoading(true);
      const base64Image = imageDataUrl.split(",")[1];
      const response = await fetch("http://localhost:9090/api/extracttext", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
      });
      const data = await response.text();
      setApiResponse(data);
    } catch (error) {
      console.error("API Error:", error);
      setApiResponse("Error contacting API");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (!croppedImageData) return;
    const a = document.createElement("a");
    a.href = croppedImageData;
    a.download = "cropped-image.png";
    a.click();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>PDF Editor</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} />
      {pdfFile && (
        <div
          ref={containerRef}
          style={{
            position: "relative",
            border: "1px solid #ccc",
            display: "inline-block",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(err) => alert("Failed to load PDF")}
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
          {selection && (
            <div
              style={{
                position: "absolute",
                border: "2px dashed red",
                backgroundColor: "rgba(255,0,0,0.1)",
                left: Math.min(selection.startX, selection.endX),
                top: Math.min(selection.startY, selection.endY),
                width: Math.abs(selection.endX - selection.startX),
                height: Math.abs(selection.endY - selection.startY),
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      )}
      <div style={{ marginTop: "20px" }}>
        {isLoading ? (
          <ClipLoader size={50} color={"#123abc"} loading={isLoading} />
        ) : (
          apiResponse && (
            <>
              <h3>API Response:</h3>
              <textarea
                readOnly
                value={apiResponse}
                rows={5}
                style={{ width: "100%" }}
              />
            </>
          )
        )}
        {croppedImageData && (
          <>
            <h3>Cropped Image Preview:</h3>
            <img src={croppedImageData} alt="Cropped" />
            <br />
            <button onClick={downloadImage}>Download Cropped Image</button>
          </>
        )}
      </div>
    </div>
  );
};

export default PdfEditor;
