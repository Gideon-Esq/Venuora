# Bundled fonts

Inter and Geist Mono are loaded through `next/font/local` in the root layout.
Their Latin variable WOFF2 files are committed so builds never fetch Google Fonts.
The existing CSS variable names and 100–900 weight ranges are preserved.

- Inter: Fontsource's Latin variable distribution, https://cdn.jsdelivr.net/fontsource/fonts/inter:vf@latest/latin-wght-normal.woff2
- Geist Mono: Latin WOFF2 bundled with the installed Next.js 16.2.10 devtools.
- Font licenses: Inter-LICENSE.txt and GeistMono-LICENSE.txt, from Google Fonts' respective font directories.

These are font assets, not new package dependencies. Updates are deliberate file replacements, not build-time downloads.
