import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    status: z.enum(['live', 'in-progress', 'archived', 'planned']).default('live'),
    url: z.string().optional(),
    repo: z.string().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    date: z.coerce.date(),
    pinned: z.boolean().default(false),
  }),
});

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    summary: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    venue: z.string().optional(),
    year: z.number(),
    status: z.enum(['working paper', 'R&R', 'published', 'draft', 'preprint']),
    pdf: z.string().optional(),
    ssrn: z.string().optional(),
    repo: z.string().optional(),
    abstract: z.string(),
    question: z.string().min(1).refine(
      (value) => (value.match(/[.!?]+(?=\s|$)/g)?.length ?? 0) <= 2,
      "Research questions must use no more than two sentences",
    ),
    maturity: z.enum(['circulating', 'working', 'development', 'earlier']),
    displayStatus: z.enum([
      'Public working paper',
      'Preprint',
      'Published dissertation',
      'Current working paper',
      'Active development · no results yet',
      'Draft · claims under verification',
    ]),
    role: z.string().min(1),
    method: z.array(z.string().min(1)).min(1),
    limit: z.string().min(1),
    discovery: z.enum(['primary', 'secondary', 'withheld']),
    distinctiveQuery: z.string().min(1).optional(),
    searchTerms: z.array(z.string().min(1)).default([]),
    tags: z.array(z.string()).default([]),
  }).superRefine((data, context) => {
    if (data.discovery === 'withheld' && !data.distinctiveQuery) {
      context.addIssue({
        code: 'custom',
        path: ['distinctiveQuery'],
        message: 'Withheld research must provide a distinctive Pagefind regression query',
      });
    }
  }),
});

const teaching = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/teaching' }),
  schema: z.object({
    title: z.string(),
    blurb: z.string(),
    url: z.string(),
    audience: z.string(),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
  }),
});

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    bio: z.string(),
    affiliation: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    orcid: z.string().optional(),
    googleScholar: z.string().optional(),
    ssrn: z.string().optional(),
    github: z.string().optional(),
    bluesky: z.string().optional(),
    linkedin: z.string().optional(),
    photo: z.string().optional(),
    interests: z.array(z.string()).default([]),
    order: z.number().default(99),
  }),
});

const datasets = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/datasets' }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    blurb: z.string(),
    year: z.number(),
    status: z.enum(['released', 'in-progress', 'planned', 'archived']),
    doi: z.string().optional(),
    zenodo: z.string().optional(),
    repo: z.string().optional(),
    viewer: z.string().optional(),
    size: z.string().optional(),
    license: z.string().default('CC-BY-4.0'),
    citation: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const econometrics = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/econometrics' }),
  schema: z.object({
    title: z.string(), order: z.number().int().min(1).max(12),
    part: z.enum(['Frame', 'Estimate', 'Identify', 'Generalize']),
    description: z.string(), question: z.string(), prerequisites: z.string(),
    minutes: z.number().positive(), lab: z.enum(['worlds', 'sampling', 'design']).optional(),
  }),
});

const measurement = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/measurement' }),
  schema: z.object({title:z.string(),description:z.string(),order:z.number().int().min(1).max(3)}),
});

export const collections = { projects, writing, research, teaching, people, datasets, econometrics, measurement };
