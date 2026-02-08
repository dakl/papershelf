import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Preserve math expressions
turndown.addRule('math', {
  filter: (node) => {
    return (
      node.nodeName === 'MATH' ||
      node.classList?.contains('ltx_Math') ||
      node.classList?.contains('ltx_equation')
    );
  },
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const altText = el.getAttribute('alttext') || el.textContent || '';
    const isBlock = el.classList?.contains('ltx_equation') || el.tagName === 'TABLE';
    return isBlock ? `\n\n$$${altText}$$\n\n` : `$${altText}$`;
  },
});

export async function fetchPaperHtml(arxivId: string): Promise<string> {
  const url = `https://arxiv.org/html/${arxivId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch HTML for ${arxivId}: ${response.status}`);
  }

  const html = await response.text();

  // Extract the article content
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const content = articleMatch ? articleMatch[1] : html;

  return turndown.turndown(content);
}
