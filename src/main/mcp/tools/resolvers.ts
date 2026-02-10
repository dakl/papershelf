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
    `arXiv ID: ${paper.arxivId}`,
    `Published: ${paper.publishedDate}`,
    `Categories: ${paper.categories.join(', ')}`,
    `URL: ${paper.arxivUrl}`,
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
  const id = paper.arxivId.replace(/[/.]/g, '_');
  const year = paper.publishedDate ? new Date(paper.publishedDate).getFullYear() : 'unknown';
  const authors = paper.authors.join(' and ');
  const primaryCategory = paper.categories[0] || '';

  return [
    `@article{${id},`,
    `  title     = {${paper.title}},`,
    `  author    = {${authors}},`,
    `  year      = {${year}},`,
    `  eprint    = {${paper.arxivId}},`,
    `  archivePrefix = {arXiv},`,
    `  primaryClass  = {${primaryCategory}},`,
    `  url       = {${paper.arxivUrl}}`,
    `}`,
  ].join('\n');
}
