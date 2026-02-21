import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  type AnnotationEntry,
  addStickyNoteAnnotation,
  listAnnotations,
  removeAnnotation,
} from '../../services/pdf-annotator';
import { resolvePaperId } from './resolvers';

interface PageAnnotations {
  pageIndex: number;
  annotations: AnnotationEntry[];
}

async function getAllAnnotationsForPaper(pdfPath: string): Promise<PageAnnotations[]> {
  const fs = await import('fs');
  const { PDFDocument } = await import('pdf-lib');

  const fileBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pageCount = pdfDoc.getPages().length;

  const results: PageAnnotations[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const annotations = await listAnnotations(pdfPath, pageIndex);
    if (annotations.length > 0) {
      results.push({ pageIndex, annotations });
    }
  }

  return results;
}

function formatAnnotation(annotation: AnnotationEntry): string {
  const type = annotation.subtype === 'Text' ? 'Sticky Note' : annotation.subtype;
  const parts = [`  - [${type}] name="${annotation.nm}"`];
  if (annotation.contents) {
    parts.push(`    text: "${annotation.contents}"`);
  }
  parts.push(`    rect: [${annotation.rect.map((n) => n.toFixed(1)).join(', ')}]`);
  return parts.join('\n');
}

export function registerAnnotationTools(server: McpServer): void {
  server.registerTool(
    'list_annotations',
    {
      description: 'List all annotations (highlights, sticky notes) for a paper. Returns annotations grouped by page.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        page: z.number().int().min(0).optional().describe('Specific page index (0-based). Omit to list all pages.'),
      },
    },
    async ({ paper_id, page }) => {
      const paper = resolvePaperId(paper_id);
      if (!paper) {
        return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
      }
      if (!paper.pdfPath) {
        return { content: [{ type: 'text' as const, text: `Paper "${paper.title}" has no PDF downloaded.` }] };
      }

      if (page !== undefined) {
        const annotations = await listAnnotations(paper.pdfPath, page);
        if (annotations.length === 0) {
          return { content: [{ type: 'text' as const, text: `No annotations on page ${page}.` }] };
        }
        const text = [`**${paper.title}** — Page ${page} (${annotations.length} annotations):\n`];
        for (const annotation of annotations) {
          text.push(formatAnnotation(annotation));
        }
        return { content: [{ type: 'text' as const, text: text.join('\n') }] };
      }

      const allPages = await getAllAnnotationsForPaper(paper.pdfPath);
      if (allPages.length === 0) {
        return { content: [{ type: 'text' as const, text: `No annotations in "${paper.title}".` }] };
      }

      const totalCount = allPages.reduce((sum, p) => sum + p.annotations.length, 0);
      const text = [`**${paper.title}** — ${totalCount} annotations across ${allPages.length} pages:\n`];

      for (const pageGroup of allPages) {
        text.push(`**Page ${pageGroup.pageIndex}** (${pageGroup.annotations.length}):`);
        for (const annotation of pageGroup.annotations) {
          text.push(formatAnnotation(annotation));
        }
        text.push('');
      }

      return { content: [{ type: 'text' as const, text: text.join('\n') }] };
    },
  );

  server.registerTool(
    'add_sticky_note',
    {
      description: 'Add a sticky note annotation to a paper PDF at a specific position.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        page: z.number().int().min(0).describe('Page index (0-based)'),
        x: z.number().describe('X position in PDF coordinates (points from left edge)'),
        y: z.number().describe('Y position in PDF coordinates (points from bottom edge)'),
        text: z.string().describe('Note text content'),
        color: z.string().optional().default('#FFEB3B').describe('Color hex code (e.g. "#FFEB3B" for yellow)'),
      },
    },
    async ({ paper_id, page, x, y, text, color }) => {
      const paper = resolvePaperId(paper_id);
      if (!paper) {
        return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
      }
      if (!paper.pdfPath) {
        return { content: [{ type: 'text' as const, text: `Paper "${paper.title}" has no PDF downloaded.` }] };
      }

      try {
        const annotationName = await addStickyNoteAnnotation(paper.pdfPath, page, x, y, text, color);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Added sticky note to "${paper.title}" page ${page} (name: ${annotationName})`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { content: [{ type: 'text' as const, text: `Failed to add sticky note: ${message}` }] };
      }
    },
  );

  server.registerTool(
    'remove_annotation',
    {
      description: 'Remove an annotation from a paper PDF by its name identifier.',
      inputSchema: {
        paper_id: z.string().describe('Paper ID (UUID) or arXiv ID'),
        page: z.number().int().min(0).describe('Page index (0-based) where the annotation is located'),
        annotation_name: z
          .string()
          .describe('Annotation name identifier (e.g. "papershelf-<uuid>"), obtained from list_annotations'),
      },
    },
    async ({ paper_id, page, annotation_name }) => {
      const paper = resolvePaperId(paper_id);
      if (!paper) {
        return { content: [{ type: 'text' as const, text: `Paper not found: ${paper_id}` }] };
      }
      if (!paper.pdfPath) {
        return { content: [{ type: 'text' as const, text: `Paper "${paper.title}" has no PDF downloaded.` }] };
      }

      try {
        const removed = await removeAnnotation(paper.pdfPath, page, annotation_name);
        if (!removed) {
          return {
            content: [{ type: 'text' as const, text: `Annotation "${annotation_name}" not found on page ${page}.` }],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: `Removed annotation "${annotation_name}" from "${paper.title}" page ${page}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { content: [{ type: 'text' as const, text: `Failed to remove annotation: ${message}` }] };
      }
    },
  );
}
