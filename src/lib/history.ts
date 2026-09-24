// Site history, read from git at build time. Needs the full history in the
// build checkout (fetch-depth: 0 in the deploy workflow); on a shallow clone
// the page simply shows fewer entries.
import { execSync } from 'node:child_process';

export interface Change {
  hash: string;
  short: string;
  date: Date;
  day: string;          // YYYY-MM-DD in the author's time zone
  subject: string;
  body: string;
  files: number;
  added: number;
  removed: number;
}

const REC = '\x1e', FLD = '\x1f';
const TRAILER = /^(Co-Authored-By|Claude-Session|Signed-off-by):/i;

export function getChanges(): Change[] {
  let raw = '';
  try {
    raw = execSync(
      `git log --no-merges --format=${REC}%H${FLD}%h${FLD}%aI${FLD}%s${FLD}%b --shortstat`,
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return [];
  }
  return raw.split(REC).filter(Boolean).map((rec) => {
    const [hash, short, iso, subject, rest = ''] = rec.split(FLD);
    const stat = rest.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?\s*$/);
    const body = (stat ? rest.slice(0, stat.index) : rest)
      .split('\n').filter((l) => !TRAILER.test(l.trim())).join('\n').trim();
    return {
      hash, short, subject: subject.trim(), body,
      date: new Date(iso), day: iso.slice(0, 10),
      files: stat ? +stat[1] : 0,
      added: stat?.[2] ? +stat[2] : 0,
      removed: stat?.[3] ? +stat[3] : 0,
    };
  });
}
