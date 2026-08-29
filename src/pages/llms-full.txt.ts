import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const sections = posts.map((p) =>
    [
      `# ${p.data.title}`,
      '',
      `URL: ${new URL(`/blog/${p.id}/`, site)}`,
      `Published: ${p.data.pubDate.toISOString().slice(0, 10)}`,
      `Tags: ${p.data.tags.join(', ')}`,
      '',
      p.body ?? '',
    ].join('\n')
  );
  return new Response(sections.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
