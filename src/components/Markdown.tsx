import type { ReactNode } from "react";

/**
 * Lightweight, dependency-free Markdown renderer for offer descriptions.
 * Renders to React elements (no dangerouslySetInnerHTML), so user-supplied
 * markdown can never inject HTML — everything else on the line is escaped
 * automatically by React.
 *
 * Supported: ## / ### headings, **bold**, *italic*, `code`,
 * [links](https://…), "- " bullet lists, ``` code fences, blank-line
 * paragraph breaks. Lines like "Stats: 250" keep their raw text (easy
 * key:value stat lines).
 */

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyBase}-i${i++}`;
    if (m[2] !== undefined) {
      nodes.push(<strong key={key} className="font-bold text-white">{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      nodes.push(<em key={key}>{m[4]}</em>);
    } else if (m[6] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-gray-800 px-1 text-[0.85em] text-emerald-300">
          {m[6]}
        </code>,
      );
    } else if (m[8] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={m[9]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-emerald-400 underline decoration-emerald-500/40 hover:decoration-emerald-400"
        >
          {m[8]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** One "block" = heading / list / fence / paragraph, keyed for React. */
type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "fence"; text: string }
  | { kind: "para"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let fence: string[] | null = null;
  let list: string[] | null = null;

  const flush = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join("\n") });
      para = [];
    }
    if (list) {
      blocks.push({ kind: "list", items: list });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (fence !== null) {
      if (/^```/.test(line.trim())) {
        blocks.push({ kind: "fence", text: fence.join("\n") });
        fence = null;
      } else {
        fence.push(raw);
      }
      continue;
    }
    if (/^```/.test(line.trim())) {
      flush();
      fence = [];
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    const h = line.trim().match(/^(#{2,3})\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ kind: "heading", level: h[1].length === 2 ? 2 : 3, text: h[2].trim() });
      continue;
    }
    if (/^[-*]\s+/.test(line.trim())) {
      if (para.length) flush();
      list = list ?? [];
      list.push(line.trim().replace(/^[-*]\s+/, ""));
      continue;
    }
    if (list) flush();
    para.push(line);
  }
  // unterminated fence — drop the partial content rather than leak markup
  flush();
  return blocks;
}

export default function Markdown({ text, className = "" }: { text: string; className?: string }) {
  if (!text || text.trim() === "") {
    return <p className={`text-xs text-gray-500 ${className}`}>No description provided.</p>;
  }
  const blocks = parseBlocks(text);

  return (
    <div className={`space-y-3 text-xs leading-relaxed text-gray-300 ${className}`}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "heading":
            return b.level === 2 ? (
              <h3 key={key} className="text-sm font-bold text-white">
                {inline(b.text, key)}
              </h3>
            ) : (
              <h4 key={key} className="text-xs font-bold uppercase tracking-wide text-gray-200">
                {inline(b.text, key)}
              </h4>
            );
          case "list":
            return (
              <ul key={key} className="list-disc space-y-1 pl-4">
                {b.items.map((it, j) => (
                  <li key={`li${j}`}>{inline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "fence":
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-xl border border-gray-800 bg-black p-3 text-[11px] text-emerald-300"
              >
                {b.text}
              </pre>
            );
          case "para":
          default:
            return (
              <p key={key} className="whitespace-pre-line">
                {inline(b.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
