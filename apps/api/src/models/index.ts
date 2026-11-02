import { CONTENT_STATUSES, DIFFICULTIES } from '@sda/shared';
import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { toJsonPlugin } from './plugins';

const slug = { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 120 };
const stringList = { type: [{ type: String, trim: true, maxlength: 60 }], default: [] };

/* ------------------------------- User -------------------------------- */
const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'editor'], default: 'editor' },
    // Hashed refresh tokens (one per active session). Raw tokens are never stored.
    refreshTokens: {
      type: [{ hash: { type: String, required: true }, expiresAt: { type: Date, required: true }, _id: false }],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);
UserSchema.index({ 'refreshTokens.hash': 1 });
UserSchema.plugin(toJsonPlugin);

/* ------------------------------ Article ------------------------------ */
const ArticleSchema = new Schema(
  {
    slug,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    summary: { type: String, required: true, trim: true, maxlength: 400 },
    simple: { type: String, required: true, maxlength: 2000 },
    body: { type: String, required: true, maxlength: 100_000 },
    category: { type: String, required: true, index: true },
    tags: stringList,
    technologies: stringList,
    patterns: stringList,
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    readingMinutes: { type: Number, required: true, min: 1, max: 120 },
    related: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date },
    popularity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
// Public listing: published articles in a category, newest first.
ArticleSchema.index({ status: 1, category: 1, publishedAt: -1 });
ArticleSchema.index({ status: 1, popularity: -1 });
// Keyword search with weighted fields.
ArticleSchema.index(
  { title: 'text', summary: 'text', tags: 'text', technologies: 'text', patterns: 'text' },
  { weights: { title: 10, tags: 5, technologies: 5, patterns: 3, summary: 2 }, name: 'article_text' },
);
ArticleSchema.plugin(toJsonPlugin);

/* ---------------------------- SystemDesign --------------------------- */
const SystemDesignSchema = new Schema(
  {
    slug,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    tagline: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 600 },
    category: { type: String, required: true, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    readingMinutes: { type: Number, required: true, min: 1, max: 180 },
    technologies: stringList,
    patterns: stringList,
    tags: stringList,
    status: { type: String, enum: CONTENT_STATUSES, default: 'draft' },
    publishedAt: { type: Date },
    popularity: { type: Number, default: 0 },
    diagramImageUrl: { type: String, maxlength: 500 },
    analogy: { title: String, story: String },
    sections: [{ id: { type: String, required: true }, title: String, simple: String, body: String, _id: false }],
    // Diagram/flow/API structures are validated by TypeScript types in the content package; stored as-is.
    diagram: { type: Schema.Types.Mixed },
    apis: { type: [Schema.Types.Mixed], default: [] },
    interviewQuestions: [{ question: String, answer: String, _id: false }],
    related: { type: [String], default: [] },
  },
  { timestamps: true, minimize: false },
);
SystemDesignSchema.index({ status: 1, publishedAt: -1 });
SystemDesignSchema.index(
  { title: 'text', summary: 'text', tags: 'text', technologies: 'text', patterns: 'text' },
  { weights: { title: 10, tags: 5, technologies: 5, patterns: 3, summary: 2 }, name: 'design_text' },
);
SystemDesignSchema.plugin(toJsonPlugin);

/* --------------------------- Category / Tag -------------------------- */
const CategorySchema = new Schema(
  {
    slug,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, maxlength: 400 },
    kind: { type: String, enum: ['concept', 'design', 'pattern'], required: true, index: true },
  },
  { timestamps: true },
);
CategorySchema.plugin(toJsonPlugin);

const TagSchema = new Schema({ slug, name: { type: String, required: true, trim: true, maxlength: 60 } }, { timestamps: true });
TagSchema.plugin(toJsonPlugin);

/* ---------------------------- LearningPath --------------------------- */
const LearningPathSchema = new Schema(
  {
    slug,
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 600 },
    audience: { type: String, required: true, maxlength: 200 },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    steps: [
      {
        title: { type: String, required: true },
        kind: { type: String, enum: ['article', 'design', 'playground'], required: true },
        ref: { type: String, required: true },
        note: { type: String, default: '' },
        _id: false,
      },
    ],
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
LearningPathSchema.plugin(toJsonPlugin);

export const User = mongoose.model('User', UserSchema);
export const Article = mongoose.model('Article', ArticleSchema);
export const SystemDesign = mongoose.model('SystemDesign', SystemDesignSchema);
export const Category = mongoose.model('Category', CategorySchema);
export const Tag = mongoose.model('Tag', TagSchema);
export const LearningPath = mongoose.model('LearningPath', LearningPathSchema);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export type ArticleDoc = InferSchemaType<typeof ArticleSchema>;
