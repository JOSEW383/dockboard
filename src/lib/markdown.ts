import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

export async function renderMarkdownFile(path: string): Promise<string> {
  let file = isAbsolute(path) ? path : resolve(process.cwd(), path);
  try { if ((await stat(file)).isDirectory()) file = join(file, 'README.md'); } catch {}
  return markdownToHtml(await readFile(file, 'utf-8'));
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
    list = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const [head, ...rows] = table.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell.trim())));
    out.push(`<table><thead><tr>${head.map((x) => `<th>${inline(x.trim())}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td>${inline(x.trim())}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    table = [];
  };

  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.startsWith('```')) {
      if (code) {
        out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        flushParagraph(); flushList(); flushTable(); code = [];
      }
      continue;
    }
    if (code) { code.push(line); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(); flushList(); flushTable();
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph(); flushTable();
      list.push(bullet[1]);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) { flushParagraph(); flushList(); flushTable(); out.push('<hr>'); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph(); flushList();
      table.push(line.trim().replace(/^\||\|$/g, '').split('|'));
      continue;
    }

    if (!line.trim()) { flushParagraph(); flushList(); flushTable(); continue; }
    flushTable();
    paragraph.push(line.trim());
  }

  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushParagraph(); flushList(); flushTable();
  return out.join('\n');
}
