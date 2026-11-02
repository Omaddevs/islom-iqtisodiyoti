/** Faqat API: sahifalar frontend (Vite) tomonida. */
const nextConfig = {
  serverExternalPackages: ['pg', 'bcryptjs', 'ws'],
  poweredByHeader: false,
  // Bir vaqtda ikkinchi nusxa (masalan, tekshiruv uchun) alohida papkada build qilinadi
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  // Monorepo: frontend (ildiz) va backend alohida lockfile'ga ega
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
}
export default nextConfig
