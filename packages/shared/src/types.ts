export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CONTENT_STATUSES = ['draft', 'published', 'planned'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Building blocks that can appear in an architecture diagram. */
export const NODE_KINDS = [
  'client',
  'dns',
  'cdn',
  'loadBalancer',
  'apiGateway',
  'service',
  'worker',
  'database',
  'cache',
  'queue',
  'storage',
  'monitoring',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface ComponentDetails {
  responsibility: string;
  inputs: string[];
  outputs: string[];
  technologies: string[];
  failureModes: string[];
}

export interface DiagramNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** One-line technical description shown under the label. */
  description: string;
  /** Plain-English explanation for complete beginners. */
  simple: string;
  position: { x: number; y: number };
  details: ComponentDetails;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Asynchronous (fire-and-forget) communication, drawn dashed. */
  async?: boolean;
}

export interface FlowStep {
  from: string;
  to: string;
  title: string;
  explanation: string;
  simple?: string;
  request?: string;
  response?: string;
  log?: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
}

export interface Diagram {
  title: string;
  /** True when this is an illustrative design, not a verified company architecture. */
  hypothetical: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  flows: Flow[];
}

export interface ApiError {
  status: number;
  code: string;
  when: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  auth?: string;
  request?: string;
  response?: string;
  errors: ApiError[];
}

/** The 22 sections every system design page follows, in order. */
export const DESIGN_SECTIONS = [
  { id: 'problem', title: 'Problem statement' },
  { id: 'functional', title: 'Functional requirements' },
  { id: 'non-functional', title: 'Non-functional requirements' },
  { id: 'assumptions', title: 'Assumptions and constraints' },
  { id: 'capacity', title: 'Capacity estimation' },
  { id: 'high-level', title: 'High-level architecture' },
  { id: 'diagram', title: 'Interactive architecture diagram' },
  { id: 'components', title: 'Component responsibilities' },
  { id: 'api', title: 'API design' },
  { id: 'database', title: 'Database schema' },
  { id: 'lifecycle', title: 'End-to-end request lifecycle' },
  { id: 'sequence', title: 'Sequence diagrams' },
  { id: 'caching', title: 'Caching strategy' },
  { id: 'scaling', title: 'Load balancing and scaling' },
  { id: 'async', title: 'Message queues and async processing' },
  { id: 'security', title: 'Authentication and security' },
  { id: 'failures', title: 'Failure scenarios and recovery' },
  { id: 'observability', title: 'Observability' },
  { id: 'deployment', title: 'Deployment architecture' },
  { id: 'tradeoffs', title: 'Bottlenecks, trade-offs and alternatives' },
  { id: 'interview', title: 'Interview questions' },
  { id: 'summary', title: 'Summary and related designs' },
] as const;
export type DesignSectionId = (typeof DESIGN_SECTIONS)[number]['id'];

export interface DesignSection {
  id: DesignSectionId;
  title: string;
  /** "In plain English" explanation shown first, and alone in Quick-read mode. */
  simple: string;
  /** Detailed Markdown body. */
  body: string;
}

export interface InterviewQuestion {
  question: string;
  answer: string;
}

export interface SystemDesignSummary {
  id?: string;
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  category: string;
  difficulty: Difficulty;
  readingMinutes: number;
  technologies: string[];
  patterns: string[];
  tags: string[];
  publishedAt: string;
  popularity: number;
  status: ContentStatus;
  diagramImageUrl?: string;
}

export interface SystemDesign extends SystemDesignSummary {
  /** Real-life analogy that explains the whole system in about 60 seconds. */
  analogy: { title: string; story: string };
  sections: DesignSection[];
  diagram?: Diagram;
  apis: ApiEndpoint[];
  interviewQuestions: InterviewQuestion[];
  related: string[];
}

export interface ArticleSummary {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  technologies: string[];
  patterns: string[];
  difficulty: Difficulty;
  readingMinutes: number;
  publishedAt: string;
  updatedAt?: string;
  popularity: number;
  status: ContentStatus;
}

export interface Article extends ArticleSummary {
  /** Plain-English explanation, readable by someone with no background. */
  simple: string;
  body: string;
  related: string[];
}

export interface Category {
  id?: string;
  slug: string;
  name: string;
  description: string;
  kind: 'concept' | 'design' | 'pattern';
}

export interface Tag {
  id?: string;
  slug: string;
  name: string;
}

export interface LearningPathStep {
  title: string;
  kind: 'article' | 'design' | 'playground';
  ref: string;
  note: string;
}

export interface LearningPath {
  id?: string;
  slug: string;
  title: string;
  description: string;
  audience: string;
  difficulty: Difficulty;
  steps: LearningPathStep[];
  status: ContentStatus;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  simple: string;
  detail: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}
