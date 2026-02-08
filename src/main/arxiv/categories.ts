export interface ArxivCategory {
  id: string;
  name: string;
  group: string;
}

export const ARXIV_CATEGORIES: ArxivCategory[] = [
  // Computer Science
  { id: 'cs.AI', name: 'Artificial Intelligence', group: 'Computer Science' },
  { id: 'cs.CL', name: 'Computation and Language', group: 'Computer Science' },
  { id: 'cs.CC', name: 'Computational Complexity', group: 'Computer Science' },
  { id: 'cs.CE', name: 'Computational Engineering, Finance, and Science', group: 'Computer Science' },
  { id: 'cs.CG', name: 'Computational Geometry', group: 'Computer Science' },
  { id: 'cs.GT', name: 'Computer Science and Game Theory', group: 'Computer Science' },
  { id: 'cs.CV', name: 'Computer Vision and Pattern Recognition', group: 'Computer Science' },
  { id: 'cs.CY', name: 'Computers and Society', group: 'Computer Science' },
  { id: 'cs.CR', name: 'Cryptography and Security', group: 'Computer Science' },
  { id: 'cs.DS', name: 'Data Structures and Algorithms', group: 'Computer Science' },
  { id: 'cs.DB', name: 'Databases', group: 'Computer Science' },
  { id: 'cs.DL', name: 'Digital Libraries', group: 'Computer Science' },
  { id: 'cs.DM', name: 'Discrete Mathematics', group: 'Computer Science' },
  { id: 'cs.DC', name: 'Distributed, Parallel, and Cluster Computing', group: 'Computer Science' },
  { id: 'cs.ET', name: 'Emerging Technologies', group: 'Computer Science' },
  { id: 'cs.FL', name: 'Formal Languages and Automata Theory', group: 'Computer Science' },
  { id: 'cs.GL', name: 'General Literature', group: 'Computer Science' },
  { id: 'cs.GR', name: 'Graphics', group: 'Computer Science' },
  { id: 'cs.AR', name: 'Hardware Architecture', group: 'Computer Science' },
  { id: 'cs.HC', name: 'Human-Computer Interaction', group: 'Computer Science' },
  { id: 'cs.IR', name: 'Information Retrieval', group: 'Computer Science' },
  { id: 'cs.IT', name: 'Information Theory', group: 'Computer Science' },
  { id: 'cs.LG', name: 'Machine Learning', group: 'Computer Science' },
  { id: 'cs.LO', name: 'Logic in Computer Science', group: 'Computer Science' },
  { id: 'cs.MA', name: 'Multiagent Systems', group: 'Computer Science' },
  { id: 'cs.MM', name: 'Multimedia', group: 'Computer Science' },
  { id: 'cs.NI', name: 'Networking and Internet Architecture', group: 'Computer Science' },
  { id: 'cs.NE', name: 'Neural and Evolutionary Computing', group: 'Computer Science' },
  { id: 'cs.NA', name: 'Numerical Analysis', group: 'Computer Science' },
  { id: 'cs.OS', name: 'Operating Systems', group: 'Computer Science' },
  { id: 'cs.OH', name: 'Other Computer Science', group: 'Computer Science' },
  { id: 'cs.PF', name: 'Performance', group: 'Computer Science' },
  { id: 'cs.PL', name: 'Programming Languages', group: 'Computer Science' },
  { id: 'cs.RO', name: 'Robotics', group: 'Computer Science' },
  { id: 'cs.SI', name: 'Social and Information Networks', group: 'Computer Science' },
  { id: 'cs.SE', name: 'Software Engineering', group: 'Computer Science' },
  { id: 'cs.SD', name: 'Sound', group: 'Computer Science' },
  { id: 'cs.SC', name: 'Symbolic Computation', group: 'Computer Science' },
  { id: 'cs.SY', name: 'Systems and Control', group: 'Computer Science' },
  // Physics
  { id: 'astro-ph', name: 'Astrophysics', group: 'Physics' },
  { id: 'cond-mat', name: 'Condensed Matter', group: 'Physics' },
  { id: 'gr-qc', name: 'General Relativity and Quantum Cosmology', group: 'Physics' },
  { id: 'hep-ex', name: 'High Energy Physics - Experiment', group: 'Physics' },
  { id: 'hep-lat', name: 'High Energy Physics - Lattice', group: 'Physics' },
  { id: 'hep-ph', name: 'High Energy Physics - Phenomenology', group: 'Physics' },
  { id: 'hep-th', name: 'High Energy Physics - Theory', group: 'Physics' },
  { id: 'math-ph', name: 'Mathematical Physics', group: 'Physics' },
  { id: 'nlin', name: 'Nonlinear Sciences', group: 'Physics' },
  { id: 'nucl-ex', name: 'Nuclear Experiment', group: 'Physics' },
  { id: 'nucl-th', name: 'Nuclear Theory', group: 'Physics' },
  { id: 'physics', name: 'Physics', group: 'Physics' },
  { id: 'quant-ph', name: 'Quantum Physics', group: 'Physics' },
  // Mathematics
  { id: 'math', name: 'Mathematics', group: 'Mathematics' },
  // Statistics
  { id: 'stat.AP', name: 'Applications', group: 'Statistics' },
  { id: 'stat.CO', name: 'Computation', group: 'Statistics' },
  { id: 'stat.ML', name: 'Machine Learning', group: 'Statistics' },
  { id: 'stat.ME', name: 'Methodology', group: 'Statistics' },
  { id: 'stat.OT', name: 'Other Statistics', group: 'Statistics' },
  { id: 'stat.TH', name: 'Statistics Theory', group: 'Statistics' },
  // Quantitative Biology
  { id: 'q-bio', name: 'Quantitative Biology', group: 'Quantitative Biology' },
  // Quantitative Finance
  { id: 'q-fin', name: 'Quantitative Finance', group: 'Quantitative Finance' },
  // Electrical Engineering and Systems Science
  { id: 'eess.AS', name: 'Audio and Speech Processing', group: 'EESS' },
  { id: 'eess.IV', name: 'Image and Video Processing', group: 'EESS' },
  { id: 'eess.SP', name: 'Signal Processing', group: 'EESS' },
  { id: 'eess.SY', name: 'Systems and Control', group: 'EESS' },
  // Economics
  { id: 'econ.EM', name: 'Econometrics', group: 'Economics' },
  { id: 'econ.GN', name: 'General Economics', group: 'Economics' },
  { id: 'econ.TH', name: 'Theoretical Economics', group: 'Economics' },
];
