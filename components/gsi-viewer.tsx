"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mammoth from 'mammoth';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // En mode export statique avec basePath /web, le worker est à cette adresse
  // Utiliser window.location.origin pour éviter les problèmes de chemins relatifs
  const origin = window.location.origin;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/web/pdf.worker.min.mjs`;
}

interface GSIViewerProps {
  url: string;
  type: 'pdf' | 'video' | 'docx' | 'image';
  onLoadComplete?: () => void;
  onError?: (err: string) => void;
}

export function GSIViewer({ url, type, onLoadComplete, onError }: GSIViewerProps) {
  const [loading, setLoading] = useState(true);
  const [pdfData, setPdfData] = useState<{ numPages: number; currentPage: number } | null>(null);
  const [scale, setScale] = useState(1.5);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log(`GSIViewer: Loading ${type} from ${url}`);
    setLoading(true);
    if (type === 'pdf') {
      renderPdf();
    } else if (type === 'docx') {
      renderDocx();
    } else if (type === 'video' || type === 'image') {
      setLoading(false);
      onLoadComplete?.();
    } else {
      setLoading(false);
      onError?.("Type de fichier non reconnu.");
    }
  }, [url, type]);

  const renderPdf = async (pageNum = 1, currentScale = scale) => {
    try {
      // Pour éviter les problèmes de CORS avec fetch, on passe directement l'URL à pdf.js
      // Mais on garde une option de repli
      const loadingTask = pdfjsLib.getDocument({
        url: url,
        withCredentials: false
      });

      const pdf = await loadingTask.promise;
      setPdfData({ numPages: pdf.numPages, currentPage: pageNum });

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext: any = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      setLoading(false);
      onLoadComplete?.();
    } catch (err: any) {
      console.error("PDF Render Error:", err);
      setLoading(false);
      onError?.(`Erreur de rendu PDF: ${err.message || 'Fichier invalide'}`);
    }
  };

  const renderDocx = async () => {
    try {
      console.log("GSIViewer: Rendering DOCX from", url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} - Échec du chargement du fichier.`);
      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength === 0) {
         throw new Error("Fichier vide ou corrompu.");
      }

      // Conversion options for Mammoth
      const options = {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h2:fresh",
          "p[style-name='Heading 2'] => h3:fresh"
        ]
      };

      // Handle both ES module and CommonJS exports
      const converter = (mammoth as any).convertToHtml || (mammoth as any).default?.convertToHtml || mammoth.convertToHtml;

      if (typeof converter !== 'function') {
         throw new Error("Moteur de rendu DOCX non disponible.");
      }

      const result = await converter({ arrayBuffer }, options);
      setDocxHtml(result.value);

      if (result.messages.length > 0) {
        console.warn("Mammoth messages:", result.messages);
      }

      setLoading(false);
      onLoadComplete?.();
    } catch (err: any) {
      console.error("DOCX Render Error:", err);
      setLoading(false);
      onError?.(`Erreur de rendu DOCX: ${err.message}`);
    }
  };

  const changePage = (offset: number) => {
    if (!pdfData) return;
    const newPage = pdfData.currentPage + offset;
    if (newPage >= 1 && newPage <= pdfData.numPages) {
      setLoading(true);
      renderPdf(newPage);
    }
  };

  const handleZoom = (delta: number) => {
     const newScale = Math.min(Math.max(scale + delta, 0.5), 4);
     setScale(newScale);
     if (type === 'pdf') {
        setLoading(true);
        renderPdf(pdfData?.currentPage || 1, newScale);
     }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-20 backdrop-blur-sm">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GSI Rendering Engine...</p>
        </div>
      )}

      <div className="flex-1 overflow-auto flex flex-col items-center p-4">
        {type === 'pdf' && (
          <div className="flex flex-col items-center">
            <div className="overflow-auto max-w-full">
               <canvas ref={canvasRef} className="shadow-2xl rounded-sm bg-white mx-auto" style={{ width: 'auto', height: 'auto' }} />
            </div>

            {/* Controls */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-30">
              {/* Zoom Controls */}
              <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 shadow-xl border border-gray-100">
                <button onClick={() => handleZoom(-0.25)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                   <ZoomOut size={20} />
                </button>
                <div className="px-3 flex items-center text-[10px] font-bold text-gray-400 border-x border-gray-100">
                   {Math.round(scale * 100)}%
                </div>
                <button onClick={() => handleZoom(0.25)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                   <ZoomIn size={20} />
                </button>
              </div>

              {/* Page Controls */}
              {pdfData && (
                <div className="bg-gray-900/90 text-white px-6 py-3 rounded-full flex items-center gap-6 backdrop-blur-md shadow-2xl border border-white/10">
                  <button onClick={() => changePage(-1)} disabled={pdfData.currentPage <= 1} className="disabled:opacity-20 active:scale-90 transition-all">
                    <ChevronLeft size={24} />
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                    Page {pdfData.currentPage} / {pdfData.numPages}
                  </span>
                  <button onClick={() => changePage(1)} disabled={pdfData.currentPage >= pdfData.numPages} className="disabled:opacity-20 active:scale-90 transition-all">
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {type === 'docx' && docxHtml && (
          <div className="w-full max-w-2xl bg-white p-8 shadow-lg rounded-2xl prose prose-sm prose-indigo animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        )}

        {type === 'video' && (
          <div className="w-full h-full flex items-center justify-center bg-black rounded-3xl overflow-hidden shadow-2xl">
            <video
              className="w-full max-h-full"
              controls
              autoPlay
              playsInline
              muted
              controlsList="nodownload"
              key={url}
              onError={(e) => {
                console.error("Video error event:", e);
                onError?.("Format vidéo non supporté ou accès refusé.");
              }}
            >
              <source src={url} type="video/mp4" />
              <source src={url} type="video/webm" />
              <source src={url} type="video/ogg" />
              Votre navigateur ne supporte pas la lecture de vidéos.
            </video>
          </div>
        )}

        {type === 'image' && (
          <div className="flex flex-col items-center gap-4">
            <div className="overflow-auto max-w-full rounded-2xl shadow-xl">
               <img
                 src={url}
                 style={{ transform: `scale(${scale / 1.5})`, transformOrigin: 'top center' }}
                 className="h-auto transition-transform duration-200"
                 alt="Document"
                 onLoad={() => { setLoading(false); onLoadComplete?.(); }}
                 onError={() => { setLoading(false); onError?.("Échec du chargement de l'image."); }}
               />
            </div>
            {/* Zoom Controls for Image */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 shadow-xl border border-gray-100 z-30">
                <button onClick={() => handleZoom(-0.25)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                   <ZoomOut size={20} />
                </button>
                <div className="px-3 flex items-center text-[10px] font-bold text-gray-400 border-x border-gray-100">
                   {Math.round(scale / 1.5 * 100)}%
                </div>
                <button onClick={() => handleZoom(0.25)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                   <ZoomIn size={20} />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
