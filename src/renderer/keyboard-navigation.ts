import { useUIStore } from './stores/uiStore';

export function handleCmdVertical(direction: 1 | -1): void {
  const ui = useUIStore.getState();

  if (ui.activePanel === 'sidebar') {
    const { sidebarFocusIndex, sidebarItemCount } = ui;
    if (sidebarItemCount === 0) return;
    const newIndex = Math.max(0, Math.min(sidebarItemCount - 1, sidebarFocusIndex + direction));
    if (newIndex !== sidebarFocusIndex) {
      useUIStore.getState().setSidebarFocusIndex(newIndex);
    }
  } else {
    const { focusedPaperIndex, paperListLength } = ui;
    if (paperListLength === 0) return;
    const newIndex = Math.max(0, Math.min(paperListLength - 1, focusedPaperIndex + direction));
    if (newIndex !== focusedPaperIndex) {
      useUIStore.getState().setFocusedPaperIndex(newIndex);
      useUIStore.getState().setActivePanel('list');
    }
  }
}

export function handleCmdHorizontal(direction: 'left' | 'right'): void {
  const ui = useUIStore.getState();
  const panels = ui.sidebarCollapsed
    ? (['list', 'detail'] as const)
    : (['sidebar', 'list', 'detail'] as const);
  const currentIndex = panels.indexOf(ui.activePanel);
  const nextIndex = direction === 'right'
    ? Math.min(panels.length - 1, currentIndex + 1)
    : Math.max(0, currentIndex - 1);
  if (nextIndex !== currentIndex) {
    useUIStore.getState().setActivePanel(panels[nextIndex]);
  }
}
