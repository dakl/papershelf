import { _electron } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'assets', 'screenshots');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', '2310.06825.pdf');

// Layout constants (must match the app)
const TITLEBAR_HEIGHT = 38;
const WINDOW_WIDTH = 1440;
const WINDOW_HEIGHT = 900;

const PAPERS = [
  {
    arxivId: '1706.03762',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez', 'Lukasz Kaiser', 'Illia Polosukhin'],
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    publishedDate: '2017-06-12T00:00:00Z',
    updatedDate: '2017-06-12T00:00:00Z',
    categories: ['cs.CL', 'cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/1706.03762',
    pdfUrl: 'https://arxiv.org/pdf/1706.03762',
    pdfPath: null as string | null, // set dynamically
    fullText: null,
  },
  {
    arxivId: '2005.14165',
    title: 'Language Models are Few-Shot Learners',
    authors: ['Tom B. Brown', 'Benjamin Mann', 'Nick Ryder', 'Melanie Subbiah', 'Jared Kaplan', 'Prafulla Dhariwal', 'Arvind Neelakantan', 'Pranav Shyam'],
    abstract: 'Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. We show that scaling up language models greatly improves task-agnostic, few-shot performance, sometimes even reaching competitiveness with prior state-of-the-art fine-tuning approaches.',
    publishedDate: '2020-05-28T00:00:00Z',
    updatedDate: '2020-07-22T00:00:00Z',
    categories: ['cs.CL'],
    arxivUrl: 'https://arxiv.org/abs/2005.14165',
    pdfUrl: 'https://arxiv.org/pdf/2005.14165',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '1810.04805',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
    publishedDate: '2018-10-11T00:00:00Z',
    updatedDate: '2019-05-24T00:00:00Z',
    categories: ['cs.CL'],
    arxivUrl: 'https://arxiv.org/abs/1810.04805',
    pdfUrl: 'https://arxiv.org/pdf/1810.04805',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '1312.6114',
    title: 'Auto-Encoding Variational Bayes',
    authors: ['Diederik P. Kingma', 'Max Welling'],
    abstract: 'How can we perform efficient inference and learning in directed probabilistic models, in the presence of continuous latent variables with intractable posterior distributions, and large datasets? We introduce a stochastic variational inference and learning algorithm that scales to large datasets and, under some mild differentiability conditions, even works in the intractable case.',
    publishedDate: '2013-12-20T00:00:00Z',
    updatedDate: '2014-05-01T00:00:00Z',
    categories: ['stat.ML', 'cs.LG'],
    arxivUrl: 'https://arxiv.org/abs/1312.6114',
    pdfUrl: 'https://arxiv.org/pdf/1312.6114',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '1511.06434',
    title: 'Unsupervised Representation Learning with Deep Convolutional Generative Adversarial Networks',
    authors: ['Alec Radford', 'Luke Metz', 'Soumith Chintala'],
    abstract: 'In recent years, supervised learning with convolutional networks (CNNs) has seen huge adoption in computer vision applications. Comparatively, unsupervised learning with CNNs has received less attention. In this work we hope to help bridge the gap between the success of CNNs for supervised learning and unsupervised learning.',
    publishedDate: '2015-11-19T00:00:00Z',
    updatedDate: '2016-01-07T00:00:00Z',
    categories: ['cs.LG', 'cs.CV'],
    arxivUrl: 'https://arxiv.org/abs/1511.06434',
    pdfUrl: 'https://arxiv.org/pdf/1511.06434',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '1505.04597',
    title: 'U-Net: Convolutional Networks for Biomedical Image Segmentation',
    authors: ['Olaf Ronneberger', 'Philipp Fischer', 'Thomas Brox'],
    abstract: 'There is large consent that successful training of deep networks requires many thousands of annotated training samples. In this paper, we present a network and training strategy that relies on the strong use of data augmentation to use the available annotated samples more efficiently.',
    publishedDate: '2015-05-18T00:00:00Z',
    updatedDate: '2015-05-18T00:00:00Z',
    categories: ['cs.CV'],
    arxivUrl: 'https://arxiv.org/abs/1505.04597',
    pdfUrl: 'https://arxiv.org/pdf/1505.04597',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '2010.11929',
    title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale',
    authors: ['Alexey Dosovitskiy', 'Lucas Beyer', 'Alexander Kolesnikov', 'Dirk Weissenborn', 'Xiaohua Zhai'],
    abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. In vision, attention is either applied in conjunction with convolutional networks, or used to replace certain components of convolutional networks while keeping their overall structure in place.',
    publishedDate: '2020-10-22T00:00:00Z',
    updatedDate: '2021-06-03T00:00:00Z',
    categories: ['cs.CV', 'cs.AI', 'cs.LG'],
    arxivUrl: 'https://arxiv.org/abs/2010.11929',
    pdfUrl: 'https://arxiv.org/pdf/2010.11929',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '1301.3781',
    title: 'Efficient Estimation of Word Representations in Vector Space',
    authors: ['Tomas Mikolov', 'Kai Chen', 'Greg Corrado', 'Jeffrey Dean'],
    abstract: 'We propose two novel model architectures for computing continuous vector representations of words from very large data sets. The quality of these representations is measured in a word similarity task, and the results are compared to the previously best performing techniques based on different types of neural networks.',
    publishedDate: '2013-01-16T00:00:00Z',
    updatedDate: '2013-09-07T00:00:00Z',
    categories: ['cs.CL'],
    arxivUrl: 'https://arxiv.org/abs/1301.3781',
    pdfUrl: 'https://arxiv.org/pdf/1301.3781',
    pdfPath: null,
    fullText: null,
  },
  {
    arxivId: '2310.06825',
    title: 'Mistral 7B',
    authors: ['Albert Q. Jiang', 'Alexandre Sablayrolles', 'Arthur Mensch', 'Chris Bamford', 'Devendra Singh Chaplot', 'Diego de las Casas', 'Florian Bressand', 'Gianna Lengyel'],
    abstract: 'We introduce Mistral 7B, a 7-billion-parameter language model engineered for superior performance and efficiency. Mistral 7B outperforms the best open 13B model (Llama 2) across all evaluated benchmarks, and the best released 34B model (Llama 1) in reasoning, mathematics, and code generation.',
    publishedDate: '2023-10-10T00:00:00Z',
    updatedDate: '2023-10-10T00:00:00Z',
    categories: ['cs.CL', 'cs.AI'],
    arxivUrl: 'https://arxiv.org/abs/2310.06825',
    pdfUrl: 'https://arxiv.org/pdf/2310.06825',
    pdfPath: null,
    fullText: null,
  },
];

const COLLECTIONS = [
  { name: 'Foundational Models', color: '#007AFF', papers: ['1706.03762', '2005.14165', '1810.04805'] },
  { name: 'Computer Vision', color: '#FF9500', papers: ['1505.04597', '2010.11929', '1511.06434'] },
  { name: 'Generative Models', color: '#AF52DE', papers: ['1312.6114', '1511.06434'] },
  { name: 'NLP & Embeddings', color: '#34C759', papers: ['1706.03762', '2005.14165', '1810.04805', '1301.3781'] },
];

const FAVORITES = ['1706.03762', '2005.14165', '1810.04805'];

// Clip region that crops the 38px titlebar (traffic lights + sidebar toggle)
const FULL_CLIP = { x: 0, y: TITLEBAR_HEIGHT, width: WINDOW_WIDTH, height: WINDOW_HEIGHT - TITLEBAR_HEIGHT };

async function main() {
  const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'papershelf-screenshots-'));
  console.log(`Using temp data dir: ${testDataDir}`);

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // ── Prepare PDF (clean, no annotations) ─────────────────
  console.log('Preparing PDF...');
  const papersDir = path.join(testDataDir, 'papers');
  fs.mkdirSync(papersDir, { recursive: true });

  const tempPdfPath = path.join(papersDir, 'mistral-temp.pdf');
  fs.copyFileSync(FIXTURE_PDF, tempPdfPath);
  const mistralIndex = PAPERS.findIndex(p => p.arxivId === '2310.06825');
  PAPERS[mistralIndex].pdfPath = tempPdfPath;

  console.log('Launching Electron...');
  const electronApp = await _electron.launch({
    args: [path.join(__dirname, '..', 'dist', 'main', 'main', 'index.js')],
    env: {
      ...process.env,
      PAPERSHELF_DATA_DIR: testDataDir,
      PAPERSHELF_E2E: '1',
    },
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // Resize to target dimensions
  await electronApp.evaluate(async ({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(size.width, size.height);
    win.center();
  }, { width: WINDOW_WIDTH, height: WINDOW_HEIGHT });

  // Seed papers
  console.log('Seeding papers...');
  const paperIdMap = await electronApp.evaluate(async (_electron, papers) => {
    const db = (global as Record<string, any>).__papershelf_db;
    const idMap: Record<string, string> = {};
    for (const paper of papers) {
      const result = db.insertPaper(paper);
      idMap[paper.arxivId] = result.id;
    }
    return idMap;
  }, PAPERS);

  // Rename the temp PDF to match the actual paper ID (matches how the app stores PDFs)
  const mistralPaperId = paperIdMap['2310.06825'];
  const finalPdfPath = path.join(papersDir, `${mistralPaperId}.pdf`);
  fs.renameSync(tempPdfPath, finalPdfPath);

  // Update the pdfPath in the database
  await electronApp.evaluate(async (_electron, { paperId, pdfPath }) => {
    const db = (global as Record<string, any>).__papershelf_db;
    db.updatePaperPdf(paperId, pdfPath, null);
  }, { paperId: mistralPaperId, pdfPath: finalPdfPath });

  // Seed collections
  console.log('Seeding collections...');
  await electronApp.evaluate(async (_electron, { collections, paperIdMap }) => {
    const db = (global as Record<string, any>).__papershelf_db;
    for (const col of collections) {
      const collection = db.createCollection(col.name, col.color);
      for (const arxivId of col.papers) {
        const paperId = paperIdMap[arxivId];
        if (paperId) db.addPaperToCollection(paperId, collection.id);
      }
    }
  }, { collections: COLLECTIONS, paperIdMap });

  // Seed tags
  console.log('Seeding tags...');
  await electronApp.evaluate(async (_electron, { paperIdMap }) => {
    const db = (global as Record<string, any>).__papershelf_db;
    const transformers = db.createTag('Transformers', '#007AFF');
    const seminal = db.createTag('Seminal', '#FF3B30');
    const twentyPlus = db.createTag('2020+', '#5856D6');

    for (const arxivId of ['1706.03762', '1810.04805', '2010.11929', '2310.06825']) {
      if (paperIdMap[arxivId]) db.addTagToPaper(paperIdMap[arxivId], transformers.id);
    }
    for (const arxivId of ['1706.03762', '2005.14165', '1810.04805', '1312.6114', '1301.3781']) {
      if (paperIdMap[arxivId]) db.addTagToPaper(paperIdMap[arxivId], seminal.id);
    }
    for (const arxivId of ['2005.14165', '2010.11929', '2310.06825']) {
      if (paperIdMap[arxivId]) db.addTagToPaper(paperIdMap[arxivId], twentyPlus.id);
    }
  }, { paperIdMap });

  // Set favorites
  console.log('Setting favorites...');
  await electronApp.evaluate(async (_electron, { favoriteArxivIds, paperIdMap }) => {
    const db = (global as Record<string, any>).__papershelf_db;
    for (const arxivId of favoriteArxivIds) {
      const paperId = paperIdMap[arxivId];
      if (paperId) db.toggleFavorite(paperId);
    }
  }, { favoriteArxivIds: FAVORITES, paperIdMap });

  // Reload the page so the Zustand store picks up seeded data
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(500);

  // ── Screenshot 1: Library with PDF viewer ──────────────
  console.log('Taking library screenshot...');
  await window.getByRole('button', { name: 'My Library' }).click();
  await window.waitForTimeout(500);

  // Select Mistral paper to show PDF in detail pane
  await window.getByText('Mistral 7B').click();
  await window.waitForTimeout(1500); // extra time for PDF rendering

  await window.screenshot({
    path: path.join(SCREENSHOT_DIR, 'library.png'),
    clip: FULL_CLIP,
  });
  console.log('  ✓ library.png');

  // ── Screenshot 2: Search (cropped to search area) ──────
  console.log('Taking search screenshot...');
  await window.getByRole('button', { name: 'Search' }).click();
  await window.waitForTimeout(300);

  await window.getByRole('button', { name: 'Library', exact: true }).click();
  await window.waitForTimeout(200);
  await window.getByPlaceholder('Search your library...').fill('language model');
  await window.locator('form').getByRole('button', { name: 'Search' }).click();
  await window.waitForTimeout(500);

  // Select a result to show detail
  await window.getByText('Mistral 7B').first().click();
  await window.waitForTimeout(1000);

  // Crop to sidebar + paper list only
  await window.screenshot({
    path: path.join(SCREENSHOT_DIR, 'search.png'),
    clip: { x: 0, y: TITLEBAR_HEIGHT, width: 560, height: 500 },
  });
  console.log('  ✓ search.png');

  // ── Screenshot 3: Collections (cropped to sidebar + list) ──
  console.log('Taking collections screenshot...');
  await window.getByRole('button', { name: 'My Library' }).click();
  await window.waitForTimeout(1000);
  await window.getByText('Foundational Models').click();
  await window.waitForTimeout(500);

  await window.getByText('Mistral 7B').first().click();
  await window.waitForTimeout(300);

  // Crop to sidebar + paper list only
  await window.screenshot({
    path: path.join(SCREENSHOT_DIR, 'collections.png'),
    clip: { x: 0, y: TITLEBAR_HEIGHT, width: 560, height: 500 },
  });
  console.log('  ✓ collections.png');

  // ── Screenshot 4: Keyboard shortcuts (hold ⌘) ──────────
  console.log('Taking shortcuts screenshot...');
  await window.getByRole('button', { name: 'My Library' }).click();
  await window.waitForTimeout(300);

  // Set commandDown via exposed Zustand store to show shortcut hints
  const storeDebug = await window.evaluate(() => {
    const store = (window as any).__shortcutStore;
    if (!store) return { error: 'store not found on window' };
    store.setState({ commandDown: true });
    const state = store.getState();
    return { commandDown: state.commandDown, shortcuts: state.shortcuts.length };
  });
  console.log('  Store debug:', storeDebug);
  await window.waitForTimeout(500);

  // Include titlebar so the real app bar is visible
  await window.screenshot({
    path: path.join(SCREENSHOT_DIR, 'shortcuts.png'),
    clip: { x: 0, y: 0, width: 560, height: 500 + TITLEBAR_HEIGHT },
  });

  await window.evaluate(() => {
    const store = (window as any).__shortcutStore;
    if (store) store.setState({ commandDown: false });
  });
  console.log('  ✓ shortcuts.png');

  // ── Screenshot 5: Dark Mode ────────────────────────────
  console.log('Taking dark mode screenshot...');
  // Both nativeTheme and emulateMedia needed for full dark mode
  await electronApp.evaluate(async ({ nativeTheme }) => {
    nativeTheme.themeSource = 'dark';
  });
  await window.emulateMedia({ colorScheme: 'dark' });
  await window.waitForTimeout(500);

  await window.getByRole('button', { name: 'My Library' }).click();
  await window.waitForTimeout(300);
  await window.getByText('Mistral 7B').first().click();
  await window.waitForTimeout(1500);

  // Crop to sidebar + paper list only
  await window.screenshot({
    path: path.join(SCREENSHOT_DIR, 'dark-mode.png'),
    clip: { x: 0, y: TITLEBAR_HEIGHT, width: 560, height: 500 },
  });
  console.log('  ✓ dark-mode.png');

  // Clean up
  console.log('Cleaning up...');
  await electronApp.close();
  fs.rmSync(testDataDir, { recursive: true, force: true });

  console.log(`\nDone! Screenshots saved to ${SCREENSHOT_DIR}`);
}

main().catch((err) => {
  console.error('Screenshot generation failed:', err);
  process.exit(1);
});
