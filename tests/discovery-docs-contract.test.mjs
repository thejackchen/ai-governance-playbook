import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const kit = fileURLToPath(new URL('..', import.meta.url));
const run = (args, cwd = kit) => spawnSync(process.execPath, args, {cwd, encoding:'utf8'});
function fixture(t) {
  const root = mkdtempSync('/tmp/gov-on-demand-');
  t.after(() => rmSync(root, {recursive:true,force:true}));
  spawnSync('git',['init','-q'],{cwd:root});
  writeFileSync(join(root,'governance.lock.json'), JSON.stringify({playbookVersion:'4.3.0',profile:'lite',schemaVersion:2,tools:['generic']}));
  writeFileSync(join(root,'owner-intent.md'),'Existing owner intent and WIP\n');
  return root;
}

test('mother version discovery is explicit and offline preserves project facts and stamp', t => {
  const root=fixture(t), original=readFileSync(join(root,'governance.lock.json'),'utf8');
  const result=run(['scripts/governance-update.mjs','--target',root,'--offline']);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/unknown|未.*检查/);
  assert.equal(readFileSync(join(root,'governance.lock.json'),'utf8'),original);
  assert.equal(readFileSync(join(root,'owner-intent.md'),'utf8'),'Existing owner intent and WIP\n');
  assert.deepEqual(readdirSync(root).sort(),['.git','governance.lock.json','owner-intent.md']);
});

test('optional v4 installer rejects an unscoped write without altering target', t => {
  const root=fixture(t), before=readdirSync(root).sort();
  const result=run(['scripts/upgrade.mjs','--target',root,'--write']);
  assert.notEqual(result.status,0);assert.match(result.stderr+result.stdout,/capability/);
  assert.deepEqual(readdirSync(root).sort(),before);
});

test('Lite preserves domain authorities instead of manufacturing requirements or catalog', t => {
  const root=fixture(t);rmSync(join(root,'governance.lock.json'));
  mkdirSync(join(root,'knowledge'));
  writeFileSync(join(root,'knowledge','requirements.md'),'Owner approved external domain contract\n');
  const result=run(['scripts/init.mjs','--target',root,'--tools','generic','--write']);
  assert.equal(result.status,0,result.stderr);
  assert.equal(readFileSync(join(root,'knowledge','requirements.md'),'utf8'),'Owner approved external domain contract\n');
  for(const path of ['docs/requirements','docs/architecture','governance/registry.md','scripts/discovery-map.mjs']) assert.equal(existsSync(join(root,path)),false,path);
});

test('on-demand catalog reports absent metadata and rejects an invalid configured source', t => {
  const root=fixture(t);
  const absent=run(['scripts/project-catalog.mjs','--root',root]);
  assert.equal(absent.status,0,absent.stderr);assert.match(absent.stdout,/未配置/);
  mkdirSync(join(root,'docs','architecture'),{recursive:true});
  writeFileSync(join(root,'docs','architecture','project-catalog.json'),JSON.stringify({schemaVersion:1,sourceRoots:['missing-source'],assets:[]}));
  const invalid=run(['scripts/project-catalog.mjs','--root',root]);
  assert.notEqual(invalid.status,0);assert.match(invalid.stdout+invalid.stderr,/missing|不存在|无效|empty/i);
});

test('single installation route and current documentation links resolve', () => {
  assert.equal(existsSync(join(kit,'setup.md')),false);
  for(const file of ['README.md','BOOTSTRAP.md','CORE.md','adapters/README.md','docs/index.md','profiles/README.md']) {
    const text=readFileSync(join(kit,file),'utf8').replace(/```[\s\S]*?```/g,'').replace(/`[^`]*`/g,'');
    for(const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link=m[1].split('#')[0];if(!link||/^https?:/.test(link)) continue;
      assert.ok(existsSync(resolve(kit,dirname(file),link)),`${file}: broken ${link}`);
    }
  }
});

test('case index covers actual mother cases exactly once instead of asserting a stale count', () => {
  const dir=join(kit,'governance/cases');
  const cases=readdirSync(dir).filter(f=>f.endsWith('.md')&&f!=='README.md').sort();
  const links=[...readFileSync(join(dir,'README.md'),'utf8').matchAll(/\]\(([^)]+\.md)\)/g)].map(m=>m[1]).sort();
  assert.deepEqual(links,cases);
  assert.equal(new Set(links).size,links.length);
});
