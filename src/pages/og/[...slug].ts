import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const posts = await getCollection('blog', ({ data }) => !data.draft);

const pages = Object.fromEntries(
  posts.map((post) => [post.id, { title: post.data.title, description: post.data.description }])
);

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  getSlug: (path) => `${path}.png`,
  getImageOptions: (_path, page: (typeof pages)[string]) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[14, 17, 22]],
    border: { color: [240, 136, 62], width: 14, side: 'inline-start' },
    padding: 72,
    font: {
      title: {
        size: 60,
        lineHeight: 1.15,
        families: ['Space Grotesk', 'Noto Sans'],
        weight: 'Bold',
        color: [240, 243, 246],
      },
      description: {
        size: 28,
        lineHeight: 1.4,
        families: ['Space Grotesk', 'Noto Sans'],
        color: [139, 148, 158],
      },
    },
    fonts: [
      'https://api.fontsource.org/v1/fonts/space-grotesk/latin-700-normal.ttf',
      'https://api.fontsource.org/v1/fonts/space-grotesk/latin-400-normal.ttf',
    ],
  }),
});
