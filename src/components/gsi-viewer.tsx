"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mammoth from 'mammoth';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { GSIStore } from '@/lib/store';

// Configure PDF.js worker
// Use a check to ensure we are in a browser environment
if (typeof window !== 'undefined') {
  // Utilisation d'un CDN pour le worker afin d'éviter les problèmes de chemins relatifs dans les sous-dossiers
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
}

interface GSIViewerProps {
  id: string;
  url: string;
  urls?: string[];
  type: 'pdf' | 'video' | 'docx' | 'image' | 'text';
  onLoadComplete?: () => void;
  onError?: (err: string) => void;
}

export function GSIViewer({ id, url, urls = [], type, onLoadComplete, onError }: GSIViewerProps) {
  const [loading, setLoading] = useState(true);
  const [displayUrl, setDisplayUrl] = useState(url);
  const [multiUrls, setMultiUrls] = useState<string[]>(urls.length > 0 ? urls : [url]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pdfData, setPdfData] = useState<{ numPages: number; currentPage: number } | null>(null);
  const [scale, setScale] = useState(1.5);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const safeUrls = Array.isArray(urls) ? urls : [];
    if (!url && safeUrls.length === 0) {
       setLoading(false);
       onError?.("Aucun contenu à afficher.");
       return;
    }

    const activeUrls = safeUrls.length > 0 ? safeUrls : [url];
    setMultiUrls(activeUrls);
    setDisplayUrl(activeUrls[0]);
    setCurrentIdx(0);

    console.log(`GSIViewer: Direct play for ${type} from ${activeUrls[0].substring(0, 50)}...`);

    // For images and videos, we rely on the Smart Proxy to handle any JSON wrapping
    // This allows us to use pure HTML5 elements for maximum reliability.
    if (type === 'image' || type === 'video' || type === 'text') {
       setLoading(type === 'image' || type === 'video');
       onLoadComplete?.();
    } else {
       setLoading(true);
       const progress = GSIStore.getProgress(id);
       const startPage = progress?.currentPage || 1;
       if (type === 'pdf') renderPdf(startPage);
       else if (type === 'docx') renderDocx();
    }
  }, [url, urls, type]);

  const renderPdf = async (pageNum = 1, currentScale = scale, targetUrl = displayUrl) => {
    try {
      // Pour les PDFs, on passe l'URL directement à PDF.js si c'est possible
      // cela permet une meilleure gestion du streaming et du cache par le navigateur
      const loadingTask = pdfjsLib.getDocument(targetUrl);
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

  const renderDocx = async (targetUrl = displayUrl) => {
    try {
      console.log("GSIViewer: Rendering DOCX from", targetUrl);
      const response = await fetch(targetUrl);
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
      const percent = Math.round((newPage / pdfData.numPages) * 100);
      const prevProgress = GSIStore.getProgress(id) || {};
      GSIStore.saveProgress(id, {
        currentPage: newPage,
        percent: Math.max(prevProgress.percent || 0, percent),
        completed: prevProgress.completed || percent === 100
      });
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

  const markFinished = () => {
     GSIStore.saveProgress(id, { completed: true, percent: 100 });
     toast.success("Leçon terminée ! Progression mise à jour.");
  };

  const currentPercent = pdfData ? Math.round((pdfData.currentPage / pdfData.numPages) * 100) : (GSIStore.getProgress(id)?.percent || 0);

  return (
    <div className="w-full h-full flex flex-col bg-gray-50 overflow-hidden relative">
      {/* Real-time progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 z-30">
         <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${currentPercent}%` }}></div>
      </div>

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
          <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
            <video
              key={displayUrl}
              src={displayUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              preload="auto"
              controlsList="nodownload"
              onCanPlay={() => setLoading(false)}
              onLoadedData={() => setLoading(false)}
              onError={(e) => {
                const v = e.currentTarget;
                console.error("GSI Media Error:", v.error?.code, v.src);
                setLoading(false);
                // Simple auto-retry without complex logic
                if (v.src.includes('proxy') && v.error?.code === 4) {
                   const rawUrl = new URL(v.src).searchParams.get('url');
                   if (rawUrl) v.src = rawUrl;
                }
              }}
            >
              Votre navigateur ne supporte pas la lecture directe.
            </video>
          </div>
        )}

        {type === 'image' && (
          <div className="flex flex-col items-center p-2 w-full" onContextMenu={(e) => e.preventDefault()}>
            <div className="overflow-auto max-w-full bg-white shadow-lg border border-gray-100 w-full flex flex-col items-center space-y-4 py-8">
               {multiUrls.map((imgUrl, idx) => (
                 <img
                   key={`${imgUrl}-${idx}`}
                   src={imgUrl}
                   draggable={false}
                   style={{ transform: `scale(${scale / 1.5})`, transformOrigin: 'top center' }}
                   className="max-w-full h-auto block mx-auto rounded-lg shadow-sm"
                   alt={`Page ${idx + 1}`}
                   onLoad={() => {
                     if (idx === multiUrls.length - 1) {
                       setLoading(false);
                       onLoadComplete?.();
                     }
                   }}
                   onError={() => setLoading(false)}
                 />
               ))}
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
            {multiUrls.length > 1 && (
               <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest z-30">
                  {multiUrls.length} Images chargées
               </div>
            )}
          </div>
        )}

        {type === 'text' && (
          <div className="w-full max-w-2xl bg-white p-8 shadow-lg rounded-[32px] border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h3 className="text-[10px] font-black uppercase text-indigo-600 mb-4 tracking-widest">Réponse de l'élève</h3>
             <div className="prose prose-sm prose-indigo max-w-none whitespace-pre-wrap font-medium text-gray-700 leading-relaxed">
                {url}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
