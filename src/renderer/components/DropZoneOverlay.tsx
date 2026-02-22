import { useCallback, useEffect, useRef, useState } from 'react';
import { usePaperStore } from '../stores/paperStore';

export function DropZoneOverlay() {
  const [visible, setVisible] = useState(false);
  const counterRef = useRef(0);
  const importFiles = usePaperStore((state) => state.importFiles);
  const importProgress = usePaperStore((state) => state.importProgress);
  const importProgressRef = useRef(importProgress);
  importProgressRef.current = importProgress;

  const isInternalDrag = useCallback((event: DragEvent) => {
    const types = event.dataTransfer?.types ?? [];
    return types.includes('application/x-paper-id') || types.includes('application/x-tag-id');
  }, []);

  const hasFiles = useCallback((event: DragEvent) => {
    const types = event.dataTransfer?.types ?? [];
    return types.includes('Files');
  }, []);

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (isInternalDrag(event) || !hasFiles(event)) return;
      event.preventDefault();
      counterRef.current++;
      if (counterRef.current === 1) setVisible(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (isInternalDrag(event)) return;
      event.preventDefault();
      counterRef.current--;
      if (counterRef.current <= 0) {
        counterRef.current = 0;
        setVisible(false);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (isInternalDrag(event) || !hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event: DragEvent) => {
      if (isInternalDrag(event)) return;
      event.preventDefault();
      counterRef.current = 0;
      setVisible(false);

      if (importProgressRef.current) return;

      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const filePath = (files[i] as File & { path?: string }).path;
        if (filePath) paths.push(filePath);
      }

      if (paths.length > 0) importFiles(paths);
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [isInternalDrag, hasFiles, importFiles]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm pointer-events-none">
      <div className="rounded-2xl border-2 border-dashed border-blue-500 bg-white/80 dark:bg-gray-900/80 px-10 py-8 text-center shadow-lg">
        <p className="text-lg font-medium text-blue-600 dark:text-blue-400">Drop PDFs to import</p>
      </div>
    </div>
  );
}
