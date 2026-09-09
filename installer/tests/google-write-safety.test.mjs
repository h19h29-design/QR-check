import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRestClient } from '../src/google/rest.mjs';
import { createResourceClients } from '../src/google/resources.mjs';

const tok = () => 'tok';
const nowait = async () => {};
const ok = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
const err = (s, o = {}) => ({ ok: false, status: s, text: async () => JSON.stringify(o) });

test('POST throw after commit is OUTCOME_UNKNOWN with exactly one attempt', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; throw new Error('socket hangup after commit'); };
  const rest = createRestClient({ fetchImpl, getToken: tok, sleep: nowait });
  await assert.rejects(rest.post('https://example.com/v1/x', { a: 1 }), (e) => e && e.kind === 'OUTCOME_UNKNOWN');
  assert.equal(n, 1);
});

test('mutations on 500/429 single attempt OUTCOME_UNKNOWN; GET retries then succeeds', async () => {
  for (const status of [500, 429]) {
    for (const m of ['post', 'put']) {
      let n = 0;
      const fetchImpl = async () => { n++; return err(status); };
      const rest = createRestClient({ fetchImpl, getToken: tok, sleep: nowait });
      await assert.rejects(rest[m]('https://example.com/v1/x', {}), (e) => e && e.kind === 'OUTCOME_UNKNOWN', `${m} ${status}`);
      assert.equal(n, 1, `${m} ${status} must not retry`);
    }
    const probe = createRestClient({ fetchImpl: async () => ok({}), getToken: tok, sleep: nowait });
    assert.ok(probe.patch, 'rest.patch missing: PATCH must exist as single-attempt mutation');
    let n = 0;
    const fetchImpl = async () => { n++; return err(status); };
    const rest = createRestClient({ fetchImpl, getToken: tok, sleep: nowait });
    await assert.rejects(rest.patch('https://example.com/v1/x', {}), (e) => e && e.kind === 'OUTCOME_UNKNOWN', `patch ${status}`);
    assert.equal(n, 1, `patch ${status} must not retry`);
  }
  let g = 0;
  const gfetch = async () => { g++; if (g < 3) return err(500); return ok({ ok: 1 }); };
  const grest = createRestClient({ fetchImpl: gfetch, getToken: tok, sleep: nowait });
  assert.deepEqual(await grest.get('https://example.com/v1/r'), { ok: 1 });
  assert.equal(g, 3);
});

test('HTTP200 unreadable/malformed is OUTCOME_UNKNOWN; 401/403 keep kind without retry', async () => {
  for (const kind of ['unreadable', 'malformed']) {
    let n = 0;
    const fetchImpl = async () => {
      n++;
      if (kind === 'unreadable') return { ok: true, status: 200, text: async () => { throw new Error('unreadable'); } };
      return { ok: true, status: 200, text: async () => '{{{' };
    };
    const rest = createRestClient({ fetchImpl, getToken: tok, sleep: nowait });
    await assert.rejects(rest.post('https://example.com/v1/x', {}), (e) => e && e.kind === 'OUTCOME_UNKNOWN', kind);
    assert.equal(n, 1, kind);
  }
  for (const [status, kind] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN']]) {
    let n = 0;
    const fetchImpl = async () => { n++; return err(status); };
    const rest = createRestClient({ fetchImpl, getToken: tok, sleep: nowait });
    await assert.rejects(rest.post('https://example.com/v1/x', {}), (e) => e && e.kind === kind, String(status));
    assert.equal(n, 1, String(status));
  }
});

test('moveIntoFolder GETs parents then PATCHes add/remove; skips mutation when already there', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body });
    const u = new URL(url);
    if ((opts.method || 'GET') === 'GET' && u.pathname.endsWith('/files/s1')) {
      assert.ok((u.searchParams.get('fields') || '').includes('parents'), 'GET must request parents');
      return ok({ id: 's1', parents: ['oldParent'] });
    }
    if ((opts.method || '') === 'PATCH') return ok({ id: 's1', parents: ['f1'] });
    return ok({});
  };
  const rc = createResourceClients({ fetchImpl, getToken: tok, sleep: nowait });
  await rc.moveIntoFolder('s1', 'f1');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.includes('/files/s1'));
  const pu = new URL(calls[1].url);
  assert.equal(calls[1].method, 'PATCH');
  assert.ok(calls[1].url.includes('/files/s1'));
  assert.equal(pu.searchParams.get('addParents'), 'f1');
  assert.equal(pu.searchParams.get('removeParents'), 'oldParent');
  assert.equal(calls[1].body, '{}');
  for (const c of calls) { assert.ok(!c.url.includes(':move'), 'must not use :move'); assert.notEqual(c.method, 'POST'); }
  const calls2 = [];
  const fetch2 = async (url, opts = {}) => {
    calls2.push({ url, method: opts.method });
    return ok({ id: 's1', parents: ['f1'] });
  };
  const rc2 = createResourceClients({ fetchImpl: fetch2, getToken: tok, sleep: nowait });
  await rc2.moveIntoFolder('s1', 'f1');
  assert.equal(calls2.length, 1);
  assert.equal(calls2[0].method, 'GET');
});

test('ambiguous/unowned candidates reject without mutation; query escapes backslash+quote', async () => {
  const mk = (body, rec) => createResourceClients({
    fetchImpl: async (url, opts = {}) => {
      rec.push({ url, method: opts.method, body: opts.body });
      if ((opts.method || 'GET') === 'GET') return ok(body);
      return ok({ id: 'new' });
    },
    getToken: tok, sleep: nowait,
  });
  for (const fn of ['findDriveFolder', 'findSpreadsheet']) {
    const rec = [];
    await assert.rejects(mk({ files: [{ id: 'a', name: 'N', ownedByMe: true }, { id: 'b', name: 'N', ownedByMe: true }] }, rec)[fn]('N'), (e) => e && e.kind === 'AMBIGUOUS_RESOURCE', `${fn} 2 items`);
  }
  const r1 = [];
  await assert.rejects(mk({ files: [{ id: 'a', name: 'N', ownedByMe: true }], nextPageToken: 't' }, r1).findDriveFolder('N'), (e) => e && e.kind === 'AMBIGUOUS_RESOURCE');
  const r2 = [];
  await assert.rejects(mk({ files: [{ id: 'a', name: 'N', ownedByMe: true }], nextPageToken: 't' }, r2).createDriveFolder('N'), (e) => e && e.kind === 'AMBIGUOUS_RESOURCE');
  assert.equal(r2.length, 1);
  const r3 = [];
  await assert.rejects(mk({ files: [{ id: 'a', name: 'N', ownedByMe: true }, { id: 'b', name: 'N', ownedByMe: true }] }, r3).createSpreadsheet('N'), (e) => e && e.kind === 'AMBIGUOUS_RESOURCE');
  assert.equal(r3.length, 1);
  const r4 = [];
  assert.equal((await mk({ files: [{ id: 'a', name: 'N', ownedByMe: true }] }, r4).findDriveFolder('N')).id, 'a');
  const r5 = [];
  await assert.rejects(mk({ files: [{ id: 'u', name: 'N', ownedByMe: false }] }, r5).createDriveFolder('N'), (e) => !!e && !!e.kind, 'unowned must reject');
  assert.equal(r5.length, 1);
  const r6 = [];
  await mk({ files: [] }, r6).findDriveFolder("a\\b'c").catch(() => {});
  const q = new URL(r6[0].url).searchParams.get('q') || '';
  assert.ok(q.includes('\\\\'), `query must escape backslash: ${q}`);
  assert.ok(q.includes("\\'"), `query must escape apostrophe: ${q}`);
});

test('empty files with nextPageToken rejects without create (zero mutation)', async () => {
  const rec = [];
  const rc = createResourceClients({
    fetchImpl: async (url, opts = {}) => {
      rec.push({ url, method: opts.method });
      if ((opts.method || 'GET') === 'GET') return ok({ files: [], nextPageToken: 't' });
      return ok({ id: 'new' });
    },
    getToken: tok, sleep: nowait,
  });
  await assert.rejects(rc.createDriveFolder('N'), (e) => e && e.kind === 'AMBIGUOUS_RESOURCE');
  assert.equal(rec.length, 1);
  assert.equal(rec[0].method, 'GET');
});

test('createVersion requires positive integer; returned IDs trim nonempty', async () => {
  for (const bad of [0, 'garbage', {}, 0.5, -1, '2']) {
    const rc = createResourceClients({
      fetchImpl: async () => ok({ versionNumber: bad }),
      getToken: tok, sleep: nowait,
    });
    await assert.rejects(rc.createVersion('s1', 'd'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', `version ${String(bad)}`);
  }
  const rcOk = createResourceClients({
    fetchImpl: async () => ok({ versionNumber: 3 }),
    getToken: tok, sleep: nowait,
  });
  assert.deepEqual(await rcOk.createVersion('s1', 'd'), { versionNumber: 3 });
  const mkId = (resp) => createResourceClients({
    fetchImpl: async (url, opts = {}) => {
      if ((opts.method || 'GET') === 'GET') return ok({ files: [] });
      return ok(resp);
    },
    getToken: tok, sleep: nowait,
  });
  await assert.rejects(mkId({ id: '   ' }).createDriveFolder('N'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'ws folder id');
  await assert.rejects(mkId({ spreadsheetId: '  ' }).createSpreadsheet('N'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'ws sheet id');
  await assert.rejects(mkId({ scriptId: '\t ' }).createScriptProject('T'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'ws script id');
});

test('deployment requires usable script.google.com exec URL, else OUTCOME_UNKNOWN', async () => {
  const good = 'https://script.google.com/macros/s/AKfycb-abc_123/exec';
  const mk = (resp) => createResourceClients({
    fetchImpl: async () => ok(resp),
    getToken: tok, sleep: nowait,
  });
  const got = await mk({ deploymentId: 'd1', entryPoints: [{ webApp: { url: good } }] }).createDeployment('s1', 3, 'd');
  assert.equal(got.webAppUrl, good);
  const bads = [
    { deploymentId: 'd1' },
    { deploymentId: 'd1', entryPoints: null },
    { deploymentId: 'd1', entryPoints: {} },
    { deploymentId: 'd1', entryPoints: [] },
    { deploymentId: 'd1', entryPoints: [{ webApp: {} }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: '' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'garbage' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'http://script.google.com/macros/s/ABC/exec' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'https://evil.com/macros/s/ABC/exec' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'https://script.google.com/macros/s/ABC/other' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'https://script.google.com/macros/s/ABC/exec?x=1' } }] },
    { deploymentId: 'd1', entryPoints: [{ webApp: { url: 'https://script.google.com/macros/s/ABC/exec#h' } }] },
    { deploymentId: '   ', entryPoints: [{ webApp: { url: good } }] },
  ];
  for (const b of bads) {
    await assert.rejects(mk(b).createDeployment('s1', 3, 'd'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', JSON.stringify(b).slice(0, 80));
  }
  await assert.rejects(mk({ deploymentId: 'd1' }).updateDeployment('s1', 'd1', 3, 'd'), (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'update missing');
  await assert.rejects(
    mk({ deploymentId: 'd1', entryPoints: [{ webApp: { url: 'https://evil.com/macros/s/ABC/exec' } }] }).updateDeployment('s1', 'd1', 3, 'd'),
    (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'update malformed',
  );
  await assert.rejects(
    mk({ deploymentId: 'd1', entryPoints: {} }).updateDeployment('s1', 'd1', 3, 'd'),
    (e) => e && e.kind === 'OUTCOME_UNKNOWN', 'update non-array',
  );
  const got2 = await mk({ deploymentId: 'd1', entryPoints: [{ webApp: { url: good } }] }).updateDeployment('s1', 'd1', 3, 'd');
  assert.equal(got2.webAppUrl, good);
});

test('GET exhausted keeps NETWORK/SERVER/ RATE_LIMITED retryable; READ_FAILED no detail; 4xx no raw detail', async () => {
  let n = 0;
  const rNet = createRestClient({ fetchImpl: async () => { n++; throw new Error('down'); }, getToken: tok, sleep: nowait });
  await assert.rejects(rNet.get('https://example.com/v1/r'), (e) => e && e.kind === 'NETWORK' && e.retryable === true);
  assert.equal(n, 3);
  for (const [status, kind] of [[500, 'SERVER_ERROR'], [429, 'RATE_LIMITED']]) {
    let m = 0;
    const r = createRestClient({ fetchImpl: async () => { m++; return err(status); }, getToken: tok, sleep: nowait });
    await assert.rejects(r.get('https://example.com/v1/r'), (e) => e && e.kind === kind && e.retryable === true && e.status === status, String(status));
    assert.equal(m, 3);
  }
  for (const k of ['unreadable', 'malformed']) {
    const f = async () => {
      if (k === 'unreadable') return { ok: true, status: 200, text: async () => { throw new Error('unreadable'); } };
      return { ok: true, status: 200, text: async () => '{{{' };
    };
    const r = createRestClient({ fetchImpl: f, getToken: tok, sleep: nowait });
    await assert.rejects(r.get('https://example.com/v1/r'), (e) => e && e.kind === 'READ_FAILED' && !String(e.detail || '').includes('{'), k);
  }
  for (const [status, kind] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND']]) {
    for (const m of ['get', 'post']) {
      const r = createRestClient({ fetchImpl: async () => err(status, { error: 'secret-body-xyz' }), getToken: tok, sleep: nowait });
      await assert.rejects(
        r[m]('https://example.com/v1/r', m === 'get' ? undefined : {}),
        (e) => e && e.kind === kind && e.status === status && !String(e.detail || '').includes('secret'),
        `${m} ${status}`,
      );
    }
  }
});
