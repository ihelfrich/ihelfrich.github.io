import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { isArchivalProject } from '../data/archival-projects.mjs';

export async function GET(context) {
  const writing = (await getCollection('writing')).filter(p => !p.data.draft);
  const research = await getCollection('research');
  const datasets = await getCollection('datasets');
  const projects = await getCollection('projects', (entry) => !isArchivalProject(entry.id));

  const items = [
    ...writing.map(p => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary,
      link: `/writing/${p.id}/`,
      categories: ['writing', ...p.data.tags]
    })),
    ...research.map(r => ({
      title: `[paper] ${r.data.title}`,
      pubDate: new Date(`${r.data.year}-01-01`),
      description: r.data.abstract,
      link: `/research/${r.id}/`,
      categories: ['research', ...r.data.tags]
    })),
    ...datasets.map(d => ({
      title: `[data] ${d.data.title}`,
      pubDate: new Date(`${d.data.year}-01-02`),
      description: d.data.blurb,
      link: `/datasets/${d.id}/`,
      categories: ['dataset', d.data.status, ...d.data.tags]
    })),
    ...projects.map(p => ({
      title: `[tool] ${p.data.title}`,
      pubDate: p.data.date,
      description: p.data.blurb,
      link: p.data.url ?? `/projects/${p.id}/`,
      categories: ['tool', p.data.status, ...p.data.tags]
    }))
  ].sort((a, b) => +b.pubDate - +a.pubDate);

  return rss({
    title: 'Ian Helfrich',
    description: 'Papers, datasets, essays, research tools, and teaching from Ian Helfrich.',
    site: context.site,
    items
  });
}
