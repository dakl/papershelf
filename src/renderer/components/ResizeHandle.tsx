import { useCallback, useRef } from 'react';
import { PAPER_LIST_DEFAULT_WIDTH, PAPER_LIST_MAX_WIDTH, PAPER_LIST_MIN_WIDTH } from '../constants';
import { useUIStore } from '../stores/uiStore';

export function ResizeHandle() {
  const setPaperListWidth = useUIStore((state) => state.setPaperListWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      dragging.current = true;

      const sidebarWidth = document.querySelector('aside')?.getBoundingClientRect().width ?? 0;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = moveEvent.clientX - sidebarWidth;
        const clamped = Math.max(PAPER_LIST_MIN_WIDTH, Math.min(PAPER_LIST_MAX_WIDTH, newWidth));
        setPaperListWidth(clamped);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [setPaperListWidth],
  );

  const onDoubleClick = useCallback(() => {
    setPaperListWidth(PAPER_LIST_DEFAULT_WIDTH);
  }, [setPaperListWidth]);

  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="w-[4px] flex-shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors duration-150"
    />
  );
}
