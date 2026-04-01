import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import DOMPurify from 'dompurify';

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (typeof window === 'undefined') {
    throw new Error('htmlToMarkdown 仅在浏览器内使用');
  }
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });
    turndown.use(gfm);
  }
  return turndown;
}

/**
 * 从网页、Word、富文本等粘贴的 HTML 转为 Markdown；先净化再转换，降低脚本风险。
 */
export function htmlToMarkdown(html: string): string {
  const clean = DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true });
  return getTurndown().turndown(clean).trim();
}

/**
 * 避免把纯文本、极短片段或无意 HTML 强行当富文本转换。
 */
export function shouldConvertHtmlPaste(html: string, plain: string): boolean {
  const h = html.trim();
  if (h.length < 12) return false;

  const structural =
    /<(?:p|div|h[1-6]|ul|ol|li|table|blockquote|pre|section|article|br|strong|b|em|a|img|code|tr|td|th|thead|tbody|figure|span|hr)\b/i;
  if (structural.test(h)) return true;
  if (/<a\s/i.test(h) || /<img\s/i.test(h)) return true;

  const p = plain.trim();
  if (p.length > 0 && h.length > p.length * 2) return true;

  return false;
}
