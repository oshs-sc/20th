// Publish committed main with Pages-only metadata, without adding files to main's root.
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const options = process.argv.slice(2);
if (options.some(value => value !== '--dry-run')) throw new Error('Use --dry-run or no arguments.');
const repositoryRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: dirname(fileURLToPath(import.meta.url)), encoding: 'utf8',
}).trim();
const git = (args, env = process.env) => execFileSync('git', args, {
  cwd: repositoryRoot, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}).trim();

git(['fetch', 'origin', 'main']);
const source = git(['rev-parse', 'origin/main']);
const roots = git(['ls-tree', '--name-only', source]).split('\n').sort();
if (roots.join('\n') !== ['README.md', 'index.html', 'typing-writing'].join('\n'))
  throw new Error('main must contain only README.md, index.html and typing-writing/.');
const remote = git(['ls-remote', '--heads', 'origin', 'gh-pages']);
const previous = remote ? remote.split(/\s/)[0] : null;
if (previous) git(['fetch', 'origin', 'gh-pages']);
const temporary = await mkdtemp(join(tmpdir(), 'oshs-pages-'));
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temporary, 'index') };
  git(['read-tree', source], env);
  for (const name of ['CNAME', '.nojekyll']) {
    const blob = git(['rev-parse', `${source}:typing-writing/${name}`]);
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], env);
  }
  const tree = git(['write-tree'], env);
  if (options.includes('--dry-run')) {
    console.log(JSON.stringify({ source, tree, branch: 'gh-pages', applied: false }));
  } else {
    const parents = previous ? ['-p', previous, '-p', source] : ['-p', source];
    const commit = git(['commit-tree', tree, ...parents, '-m', `Deploy main ${source}`]);
    // A regular fast-forward push rejects a concurrent publisher; never force-push.
    git(['push', 'origin', `${commit}:refs/heads/gh-pages`]);
    console.log(JSON.stringify({ source, commit, branch: 'gh-pages', applied: true }));
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
