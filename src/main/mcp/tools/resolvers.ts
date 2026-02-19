import type { Collection, LibraryPaper, Tag } from '../../../shared/types';
import * as db from '../../database';

export function resolvePaperId(idOrArxivId: string): LibraryPaper | null {
  return db.getPaperById(idOrArxivId) ?? db.getPaperByArxivId(idOrArxivId);
}

export function resolveCollectionId(idOrName: string): Collection | null {
  const collections = db.getCollections();
  const byId = collections.find((c) => c.id === idOrName);
  if (byId) return byId;
  return db.getCollectionByName(idOrName);
}

export function resolveTagId(idOrName: string): Tag | null {
  const tags = db.getTags();
  const byId = tags.find((t) => t.id === idOrName);
  if (byId) return byId;
  return db.getTagByName(idOrName);
}

export function formatPaper(paper: LibraryPaper): string {
  return [
    `**${paper.title}**`,
    `Authors: ${paper.authors.join(', ')}`,
    paper.arxivId ? `arXiv ID: ${paper.arxivId}` : '',
    paper.doi ? `DOI: ${paper.doi}` : '',
    `Source: ${paper.source}`,
    `Published: ${paper.publishedDate}`,
    paper.categories.length > 0 ? `Categories: ${paper.categories.join(', ')}` : '',
    paper.arxivUrl ? `URL: ${paper.arxivUrl}` : '',
    paper.isFavorite ? 'Favorited' : '',
    paper.collections.length > 0 ? `Collections: ${paper.collections.map((c) => c.name).join(', ')}` : '',
    paper.tags.length > 0 ? `Tags: ${paper.tags.map((t) => t.name).join(', ')}` : '',
    '',
    paper.abstract,
  ]
    .filter(Boolean)
    .join('\n');
}

export function generateBibtex(paper: LibraryPaper): string {
  const bibtexKey = paper.arxivId
    ? paper.arxivId.replace(/[/.]/g, '_')
    : paper.doi
      ? paper.doi.replace(/[/.]/g, '_')
      : paper.id.slice(0, 8);
  const year = paper.publishedDate ? new Date(paper.publishedDate).getFullYear() : 'unknown';
  const authors = paper.authors.join(' and ');
  const primaryCategory = paper.categories[0] || '';

  const lines = [
    `@article{${bibtexKey},`,
    `  title     = {${paper.title}},`,
    `  author    = {${authors}},`,
    `  year      = {${year}},`,
  ];

  if (paper.arxivId) {
    lines.push(`  eprint    = {${paper.arxivId}},`);
    lines.push(`  archivePrefix = {arXiv},`);
  }
  if (primaryCategory) {
    lines.push(`  primaryClass  = {${primaryCategory}},`);
  }
  if (paper.doi) {
    lines.push(`  doi       = {${paper.doi}},`);
  }

  const url = paper.arxivUrl || (paper.doi ? `https://doi.org/${paper.doi}` : '');
  if (url) {
    lines.push(`  url       = {${url}}`);
  }

  lines.push(`}`);
  return lines.join('\n');
}
