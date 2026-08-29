import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const lines = [
    '# Closed Loop',
    '',
    '> AI engineering, evidenced. Long-form technical articles on agentic systems,',
    '> Claude Code, and AI infrastructure by Damian, a senior AI engineer in Sheffield, UK.',
    '> Every article documents a system that ran in production — architecture, hard gates,',
    '> and the failures that shaped the rules.',
    '',
    'Damian is available for remote freelance AI engineering work: agentic system',
    'design and build, Claude Code enablement for teams, and AI infrastructure',
    `consulting. Contact: djsystems@proton.me — see ${new URL('/services/', site)}`,
    '',
    '## Articles',
    '',
    ...posts.map(
      (p) =>
        `- [${p.data.title}](${new URL(`/blog/${p.id}/`, site)}): ${p.data.description}`
    ),
    '',
    '## Pages',
    '',
    `- [About](${new URL('/about/', site)}): who Damian is and what this site is`,
    `- [Services](${new URL('/services/', site)}): freelance AI engineering offers`,
    `- [RSS feed](${new URL('/rss.xml', site)})`,
    '',
    '## Full content',
    '',
    `- [llms-full.txt](${new URL('/llms-full.txt', site)}): full text of every article in markdown`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
