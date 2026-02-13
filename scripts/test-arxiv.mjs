#!/usr/bin/env node

const url = 'https://export.arxiv.org/api/query?search_query=all:electron&start=0&max_results=3';

const agents = {
  'No header': undefined,
  'PaperShelf/0.4.0': 'PaperShelf/0.4.0',
  'Chrome': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Python requests': 'python-requests/2.31.0',
  'Node default': 'node',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function test(label, userAgent) {
  const headers = userAgent ? { 'User-Agent': userAgent } : {};
  try {
    const res = await fetch(url, { headers });
    const body = await res.text();
    const isXml = body.trimStart().startsWith('<?xml');
    console.log(`${label.padEnd(22)} -> HTTP ${res.status} ${isXml ? '(valid XML)' : '(not XML)'}`);
  } catch (e) {
    console.log(`${label.padEnd(22)} -> ERROR: ${e.message}`);
  }
}

(async () => {
  console.log('Testing arXiv API with different User-Agent strings');
  console.log('3s delay between each request\n');

  for (const [label, ua] of Object.entries(agents)) {
    await test(label, ua);
    await sleep(3000);
  }
})();
