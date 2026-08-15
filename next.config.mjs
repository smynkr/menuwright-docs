import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // The site serves local SVG wordmarks and plain MDX screenshots; it does not
  // need Next's native raster optimizer. Keep optimization disabled so
  // untrusted raster input cannot reach the optional Sharp decoder.
  images: { unoptimized: true },
  // Pin the workspace root: stray lockfiles in ~ and ~/Documents make Turbopack
  // infer a root above this repo and fail on ~'s offloaded node_modules symlink.
  turbopack: { root: import.meta.dirname },
  async redirects() {
    return [
      // Browsers probe /favicon.ico even though we serve /favicon.svg.
      { source: '/favicon.ico', destination: '/favicon.svg', permanent: true },
      // Mintlify served section indexes at /<section>/index; Fumadocs serves
      // them at /<section>. Keep old deep links and bookmarks working.
      { source: '/menuwright/index', destination: '/menuwright', permanent: true },
    ];
  },
  async rewrites() {
    return [
      // Clean standalone URLs: docs.menuwright.com/<page> serves the
      // /menuwright/<page> route. The canonical source keeps its product
      // prefix; the rewrite keeps the pretty URL in the address bar.
      { source: '/', destination: '/menuwright' },
      { source: '/getting-started', destination: '/menuwright/getting-started' },
      { source: '/menu-matrix', destination: '/menuwright/menu-matrix' },
      { source: '/square', destination: '/menuwright/square' },
      { source: '/csv-import', destination: '/menuwright/csv-import' },
      { source: '/billing', destination: '/menuwright/billing' },
      { source: '/reports', destination: '/menuwright/reports' },
      { source: '/faq', destination: '/menuwright/faq' },
      { source: '/insights-trends', destination: '/menuwright/insights-trends' },
      { source: '/menu-scan', destination: '/menuwright/menu-scan' },
      { source: '/data-import', destination: '/menuwright/data-import' },
      { source: '/account-branding', destination: '/menuwright/account-branding' },
      { source: '/changelog', destination: '/menuwright/changelog' },
    ];
  },
};

export default withMDX(config);
