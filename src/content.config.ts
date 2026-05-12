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
    tags: z.array(z.string()).default([]),
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

export const collections = { projects, writing, research, teaching };
