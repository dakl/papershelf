import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useCitationStore } from '../stores/citationStore';

interface GraphNode {
  id: string;
  label: string;
  inLibrary: boolean;
  isSeed: boolean;
  year: number | null;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export function CitationForceGraph() {
  const nodes = useCitationStore((s) => s.nodes);
  const edges = useCitationStore((s) => s.edges);
  const seedArxivIds = useCitationStore((s) => s.seedArxivIds);
  const selectedNodeId = useCitationStore((s) => s.selectedNodeId);
  const selectNode = useCitationStore((s) => s.selectNode);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Mutable refs for the stable canvas callback
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const hoveredNodeIdRef = useRef<string | null>(null);

  const seedArxivIdSet = useMemo(() => new Set(seedArxivIds), [seedArxivIds]);

  const graphData = useMemo(() => {
    const graphNodes: GraphNode[] = nodes.map((n) => ({
      id: n.semanticScholarId,
      label: n.title,
      inLibrary: n.inLibrary,
      isSeed: n.arxivId !== null && seedArxivIdSet.has(n.arxivId),
      year: n.year,
    }));

    const graphLinks: GraphLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, seedArxivIdSet]);

  const handleNodeClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      selectNode(node.id as string);
    },
    [selectNode],
  );

  const handleNodeHover = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any) => {
      hoveredNodeIdRef.current = node ? (node.id as string) : null;
      // Change cursor to indicate clickability
      if (containerRef.current) {
        containerRef.current.style.cursor = node ? 'pointer' : 'default';
      }
    },
    [],
  );

  // Stable callback — reads mutable refs, never changes identity
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isSelected = node.id === selectedNodeIdRef.current;
      const isHovered = node.id === hoveredNodeIdRef.current;
      const radius = node.isSeed ? 8 : node.inLibrary ? 6 : 4;
      const color = node.isSeed ? '#22C55E' : node.inLibrary ? '#007AFF' : '#9CA3AF';

      if (node.isSeed) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
        ctx.strokeStyle = '#16A34A';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Labels: only for hovered or selected nodes. Seed labels at moderate zoom.
      // Only show label on hover or selected
      if (isSelected || isHovered) {
        const label = node.label.length > 40 ? node.label.slice(0, 40) + '...' : node.label;
        const fontSize = Math.max(12 / globalScale, 3);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4 / globalScale;
        ctx.lineJoin = 'round';
        ctx.strokeText(label, x, y + radius + 3);

        ctx.fillStyle = isSelected ? '#D97706' : '#374151';
        ctx.fillText(label, x, y + radius + 3);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Large hit area for reliable clicking
  const nodePointerAreaPaint = useCallback((node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const linkColor = useCallback(() => 'rgba(156, 163, 175, 0.3)', []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 60);
      }, 500);
    }
  }, [graphData.nodes.length]);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden min-w-0">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkColor={linkColor}
        linkWidth={0.5}
        cooldownTicks={100}
        d3AlphaDecay={0.1}
        d3VelocityDecay={0.6}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />
    </div>
  );
}
