import type { IPostMedia, IPostTopicData } from './interfaces/forumPost';

/**
 * Hilfsklasse: transformiert HTML einer Forum-Thread-Seite (z. B. Discourse)
 * in strukturierte Daten (Topics mit Markdown-Body und Medien).
 * Nutzung neben Kubrow im gleichen Ordner.
 */
export class ForumPostParser {
    /**
     * Parst HTML des ersten Posts und liefert Topic-Liste inkl. Markdown und Medien.
     * @param html Roh-HTML der Thread-Seite
     * @param url Thread-URL (für Kontext)
     */
    parse(html: string, url: string): {
        title: string;
        author: string;
        date: string;
        url: string;
        topics: IPostTopicData[];
    } {
        const title = this.extractTitle(html);
        const { author, date } = this.extractAuthorAndDate(html);
        const firstPostHtml = this.extractFirstPostBody(html);
        const topics = this.splitIntoTopics(firstPostHtml);

        return {
            title,
            author,
            date,
            url,
            topics,
        };
    }

    private extractTitle(html: string): string {
        const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (match) {
            return this.stripHtml(match[1]).trim();
        }
        return '';
    }

    private extractAuthorAndDate(html: string): { author: string; date: string } {
        // Discourse: data-username, oder typische Muster "By ... , ... in"
        const authorMatch = html.match(/data-username="([^"]+)"/i)
            ?? html.match(/By\s+<[^>]+>([^<]+)</i)
            ?? html.match(/class="[^"]*username[^"]*"[^>]*>([^<]+)</i);
        const dateMatch = html.match(/data-time="(\d+)"|datetime="([^"]+)"|(\d{1,2}\s+\w+\s+\d{4})/i);
        return {
            author: authorMatch ? this.stripHtml(authorMatch[1]).trim() : '',
            date: dateMatch ? (dateMatch[1] ?? dateMatch[2] ?? dateMatch[3] ?? '') : '',
        };
    }

    private extractFirstPostBody(html: string): string {
        // Discourse: .cooked im ersten .topic-post
        const cookedMatch = html.match(/class="[^"]*cooked[^"]*"[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/im)
            ?? html.match(/class="post[^"]*"[\s\S]*?class="[^"]*content[^"]*"[\s\S]*?>([\s\S]*?)<\/div>/im);
        if (cookedMatch) {
            return cookedMatch[1];
        }
        // Fallback: ersten größeren Content-Block nehmen
        const fallback = html.match(/<article[\s\S]*?>([\s\S]{100,}?)<\/article>/im);
        return fallback ? fallback[1] : html;
    }

    private splitIntoTopics(postHtml: string): IPostTopicData[] {
        const topics: IPostTopicData[] = [];
        // Nach Überschriften (h2/h3) in Abschnitte teilen
        const headingRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        const parts: { title: string; start: number; end: number }[] = [];
        while ((match = headingRegex.exec(postHtml)) !== null) {
            if (parts.length > 0) {
                parts[parts.length - 1].end = match.index;
            }
            parts.push({
                title: this.stripHtml(match[1]).trim(),
                start: match.index + match[0].length,
                end: postHtml.length,
            });
            lastIndex = match.index + match[0].length;
        }

        if (parts.length === 0) {
            // Ein Topic mit dem gesamten Inhalt
            const media = this.extractMedia(postHtml);
            const bodyMarkdown = this.htmlToMarkdown(postHtml);
            topics.push({ title: '', bodyMarkdown, media });
            return topics;
        }

        for (const part of parts) {
            const sectionHtml = postHtml.slice(part.start, part.end);
            const media = this.extractMedia(sectionHtml);
            const bodyMarkdown = this.htmlToMarkdown(sectionHtml);
            topics.push({ title: part.title, bodyMarkdown, media });
        }

        return topics;
    }

    private extractMedia(html: string): IPostMedia[] {
        const media: IPostMedia[] = [];

        // Bilder: <img src="...">
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
        let m: RegExpExecArray | null;
        while ((m = imgRegex.exec(html)) !== null) {
            media.push({
                type: 'image',
                url: this.normalizeUrl(m[1]),
                alt: m[2]?.trim() || undefined,
            });
        }

        // Videos: <video src="..."> oder <source src="...">
        const videoSrcRegex = /<video[\s\S]*?src=["']([^"']+)["']|<source[^>]+src=["']([^"']+\.(?:mp4|webm|ogg))["']/gi;
        while ((m = videoSrcRegex.exec(html)) !== null) {
            media.push({
                type: 'video',
                url: this.normalizeUrl(m[1] || m[2] || ''),
            });
        }

        // Embed: iframe (YouTube, Vimeo etc.)
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        while ((m = iframeRegex.exec(html)) !== null) {
            const src = m[1];
            if (/youtube|vimeo|dailymotion/i.test(src)) {
                media.push({
                    type: 'video',
                    url: this.normalizeUrl(src),
                    thumbnailUrl: undefined,
                });
            }
        }

        return media;
    }

    private htmlToMarkdown(html: string): string {
        let md = html
            .replace(/<p>/gi, '\n\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
                const prefix = '#'.repeat(parseInt(level, 10));
                return `\n\n${prefix} ${this.stripHtml(content).trim()}\n\n`;
            })
            .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, c) => `**${this.stripHtml(c).trim()}**`)
            .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, c) => `**${this.stripHtml(c).trim()}**`)
            .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, c) => `*${this.stripHtml(c).trim()}*`)
            .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, c) => `*${this.stripHtml(c).trim()}*`)
            .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${this.stripHtml(text).trim()}](${href})`)
            .replace(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi, (_, src, alt) => `![${(alt || '').trim()}](${src})`)
            .replace(/<[^>]+>/g, '');
        md = md.replace(/\n{3,}/g, '\n\n').trim();
        return md;
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }

    private normalizeUrl(url: string): string {
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) return 'https://forums.warframe.com' + url;
        return url;
    }
}
