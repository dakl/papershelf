import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export function usePdfDocument(paperId: string, pdfVersion: number) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevPaperIdRef = useRef(paperId);
  const documentRef = useRef<PDFDocumentProxy | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion intentionally triggers re-fetch after annotation mutations
  useEffect(() => {
    let cancelled = false;
    const paperChanged = paperId !== prevPaperIdRef.current;
    prevPaperIdRef.current = paperId;

    if (paperChanged) {
      setLoading(true);
      setPdfDocument(null);
      setNumPages(0);
      // Destroy old document when switching papers
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
    }
    setError(null);

    window.electronAPI.getPdf(paperId).then(async (buffer) => {
      if (cancelled) return;
      if (!buffer) {
        setError('PDF file not found');
        setLoading(false);
        return;
      }

      const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
      // pdfjs transfers ownership, so we must copy
      const copy = new Uint8Array(source.length);
      copy.set(source);

      try {
        // Destroy previous document before loading new one (annotation reload case)
        if (documentRef.current) {
          documentRef.current.destroy();
          documentRef.current = null;
        }

        const doc = await pdfjsLib.getDocument({ data: copy }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        documentRef.current = doc;
        setPdfDocument(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [paperId, pdfVersion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
    };
  }, []);

  return { pdfDocument, numPages, loading, error };
}
