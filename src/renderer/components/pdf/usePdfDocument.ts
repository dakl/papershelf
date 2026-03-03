import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// PDF.js appends CMap filenames to this URL prefix to fetch them on demand.
import cMapSample from 'pdfjs-dist/cmaps/78-H.bcmap?url';

const cMapUrl = cMapSample.replace(/[^/]+$/, '');

import { useEffect, useRef, useState } from 'react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export function usePdfDocument(paperId: string | null, pdfVersion: number, pdfUrl?: string, arxivId?: string) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sourceKey = paperId ?? pdfUrl ?? '';
  const prevSourceRef = useRef(sourceKey);
  const documentRef = useRef<PDFDocumentProxy | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pdfVersion intentionally triggers re-fetch after annotation mutations
  useEffect(() => {
    let cancelled = false;
    const sourceChanged = sourceKey !== prevSourceRef.current;
    prevSourceRef.current = sourceKey;

    if (sourceChanged) {
      setLoading(true);
      setPdfDocument(null);
      setNumPages(0);
      if (documentRef.current) {
        documentRef.current.destroy();
        documentRef.current = null;
      }
    }
    setError(null);

    const fetchBuffer = paperId
      ? window.electronAPI.getPdf(paperId)
      : pdfUrl && arxivId
        ? window.electronAPI.fetchPdfByUrl(pdfUrl, arxivId)
        : Promise.resolve(null);

    fetchBuffer
      .then(async (buffer) => {
        if (cancelled) return;
        if (!buffer) {
          setError('PDF file not found');
          setLoading(false);
          return;
        }

        const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
        const copy = new Uint8Array(source.length);
        copy.set(source);

        try {
          const prevDoc = documentRef.current;

          const doc = await pdfjsLib.getDocument({ data: copy, cMapUrl, cMapPacked: true }).promise;
          if (cancelled) {
            doc.destroy();
            return;
          }
          documentRef.current = doc;
          setPdfDocument(doc);
          setNumPages(doc.numPages);
          setLoading(false);

          // Destroy old document after new one is ready so in-flight
          // getPage() calls against the previous doc don't fail.
          if (prevDoc) {
            prevDoc.destroy();
          }
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch PDF');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceKey, pdfVersion]);

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
