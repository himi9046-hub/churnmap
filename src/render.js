const BAR = 10;

export function makeStyle(enabled) {
  const paint = (code) => (s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);
  return { bold: paint('1'), dim: paint('2'), red: paint('31'), yellow: paint('33'), green: paint('32') };
}

export function ago(then, now) {
  const days = Math.floor((now - then) / 86400);
  if (days < 1) return 'today';
  if (days < 14) return `${days}d`;
  if (days < 70) return `${Math.floor(days / 7)}w`;
  if (days < 730) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function clip(s, width) {
  if (s.length <= width) return s;
  return '…' + s.slice(s.length - width + 1);
}

function heat(style, score) {
  if (score >= 66) return style.red;
  if (score >= 33) return style.yellow;
  return style.green;
}

function bar(score) {
  const full = Math.round((score / 100) * BAR);
  return '█'.repeat(full) + '·'.repeat(BAR - full);
}

export function renderHotspots(rows, { style, columns = 100, now = Date.now() / 1000 }) {
  if (rows.length === 0) return 'No tracked text files with history matched.\n';

  const heads = ['#', 'score', 'commits', 'lines', 'authors', 'owner', 'last'];
  const cells = rows.map((r, i) => [
    String(i + 1),
    String(r.score),
    String(r.commits),
    String(r.lines),
    String(r.authors),
    `${Math.round(r.owner.share * 100)}%`,
    ago(r.last, now),
  ]);
  const widths = heads.map((h, c) => Math.max(h.length, ...cells.map((row) => row[c].length)));

  // the score column carries its bar in front of the number
  widths[1] = 3;
  const scoreWidth = BAR + 1 + widths[1];
  const fixed = 2 + widths.reduce((sum, w) => sum + w + 2, 0) + BAR + 1;
  const room = Math.max(16, columns - fixed);

  const header = heads.map((h, c) => (c === 1 ? h.padStart(scoreWidth) : h.padStart(widths[c])));
  const lines = ['  ' + style.dim([...header, 'file'].join('  '))];

  rows.forEach((r, i) => {
    const row = cells[i];
    const color = heat(style, r.score);
    const out = row.map((v, c) => v.padStart(widths[c]));
    out[1] = color(bar(r.score)) + ' ' + out[1];
    out[5] = r.owner.share >= 0.8 && r.commits >= 5 ? style.yellow(out[5]) : out[5];
    out[6] = style.dim(out[6]);
    lines.push('  ' + out.join('  ') + '  ' + (r.score >= 66 ? style.bold(clip(r.path, room)) : clip(r.path, room)));
  });

  return lines.join('\n') + '\n';
}

export function renderCoupling(rows, { style, columns = 100 }) {
  if (rows.length === 0) return style.dim('  No file pairs change together often enough to report.') + '\n';

  const sharedWidth = Math.max(...rows.map((r) => String(r.shared).length));
  const room = Math.max(20, columns - 2 - 4 - 2 - sharedWidth - 3 - 2);
  const half = Math.floor((room - 3) / 2);

  const lines = rows.map((r) => {
    const pct = `${r.degree}%`.padStart(4);
    const shared = `${r.shared}x`.padStart(sharedWidth + 1);
    const left = clip(r.a, half);
    const right = clip(r.b, room - 3 - left.length);
    return `  ${heat(style, r.degree)(pct)}  ${style.dim(shared)}  ${left} ${style.dim('<->')} ${right}`;
  });
  return lines.join('\n') + '\n';
}
