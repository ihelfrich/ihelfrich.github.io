import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const writing = (await getCollection('writing')).filter(p => !p.data.draft);
  const research = await getCollection('research');

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
    }))
  ].sort((a, b) => +b.pubDate - +a.pubDate);

  return rss({
    title: 'Ian Helfrich',
    description: 'Applied causal inference, blended-finance research, and teaching.',
    site: context.site,
    items
  });
}
