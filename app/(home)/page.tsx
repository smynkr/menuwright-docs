import { DocsContentPage } from '@/components/docs-content-page';
import { getPageImage, source } from '@/lib/source';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * The product index doubles as the landing page: `/` renders
 * /menuwright's content so the address bar stays product-prefix-free.
 * A real page here (rather than a next.config rewrite) is what makes the
 * nav logo's soft navigation to `/` work — the client router does not
 * apply rewrites, so a rewrite-only `/` 404'd on logo click until reload.
 */
const HOME_SLUG = ['menuwright'];

export default function HomePage() {
  const page = source.getPage(HOME_SLUG);
  if (!page) notFound();
  return <DocsContentPage page={page} />;
}

export async function generateMetadata(): Promise<Metadata> {
  const page = source.getPage(HOME_SLUG);
  if (!page) notFound();
  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      type: 'website',
      siteName: 'MenuWright Docs',
      title: page.data.title,
      description: page.data.description,
      images: getPageImage(page).url,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.data.title,
      description: page.data.description,
      images: getPageImage(page).url,
    },
  };
}
