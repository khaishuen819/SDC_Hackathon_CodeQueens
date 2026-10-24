// FICTIONAL test data only. These are not real publisher articles and must
// never be shown as trend evidence. Hosts match the configured feeds so the
// bounded fetcher accepts them; the content is invented for tests.

export type FixtureItem = { title: string; link: string; pubDate?: string; body: string };

export function rssFeed(items: FixtureItem[]): string {
  const entries = items.map((item) => `<item><title>${item.title}</title><link>${item.link}</link>` +
    (item.pubDate === undefined ? "" : `<pubDate>${item.pubDate}</pubDate>`) +
    `<description><![CDATA[${item.body}]]></description></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FICTIONAL feed</title>${entries}</channel></rss>`;
}

export const FICTIONAL_BODY = "<p>FICTIONAL: Developers can now verify API behaviour using reproducible checks &amp; inspect results.</p>" +
  "<p>Read the <a href=\"https://developer.mozilla.org/en-US/docs/Web/HTTP/Status?utm_source=feed\">status guide</a> " +
  "and <a href=\"https://unlisted.example/guide\">another site</a>.</p>";

export function item(n: number, overrides: Partial<FixtureItem> = {}): FixtureItem {
  return { title: `FICTIONAL update ${n}`, link: `https://github.blog/changelog/2026-10-0${n % 9 + 1}-fictional-${n}/`,
    pubDate: `Fri, 0${n % 9 + 1} Oct 2026 10:00:00 +0000`, body: FICTIONAL_BODY, ...overrides };
}

export const RESOURCE_PAGE = "<html><head><title>FICTIONAL status guide</title><script>ignored()</script></head>" +
  "<body><h1>FICTIONAL guide</h1><p>Practise checking HTTP status codes with a runnable example &amp; verify the output.</p></body></html>";
