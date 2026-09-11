// Go Muse/xhigh; public synthetic only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResourceClients } from '../src/google/resources.mjs';
function client(calls, resp = {}) {
  const fetchImpl = async (url, opts) => { calls.push({ url: String(url), method: opts && opts.method }); return { ok: true, status: 200, text: async () => JSON.stringify(resp) }; };
  return createResourceClients({ fetchImpl, getToken: () => 'test', sleep: async () => {} });
}
test('getFileMetadata GET Drive shape, encoded, only GET', async () => {
  const calls = [];
  const c = client(calls, { id: 'f1', name: 'n', mimeType: 'm', ownedByMe: true, trashed: false, parents: [] });
  await c.getFileMetadata('f1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.includes('/drive/v3/files/f1?'));
  assert.ok(calls[0].url.includes('fields=id,name,mimeType,ownedByMe,trashed,parents'));
  assert.ok(!calls[0].url.includes('test'));
});
test('getProject reads Apps Script metadata without Drive API', async () => {
  const calls = [];
  const c = client(calls, { scriptId: 'sc 1', title: 'n', creator: { email: 'owner@example.com' } });
  await c.getProject('sc 1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.endsWith('/projects/sc%201'));
  assert.ok(!calls[0].url.includes('/drive/'));
});
test('getContent HEAD no query; versioned uses versionNumber query', async () => {
  const calls = [];
  const c = client(calls, { scriptId: 'sc1', files: [] });
  await c.getContent('sc1');
  assert.equal(calls[0].method, 'GET');
  assert.ok(calls[0].url.includes('/projects/sc1/content'));
  assert.ok(!calls[0].url.includes('versionNumber'));
  await c.getContent('sc1', 1);
  assert.equal(calls[1].method, 'GET');
  assert.ok(calls[1].url.includes('/projects/sc1/content'));
  assert.ok(calls[1].url.includes('versionNumber=1'));
  for (const cl of calls) assert.equal(cl.method, 'GET');
});
test('zero/negative/unsafe/noninteger versions reject before network', async () => {
  for (const v of [0, -1, -5, 1.5, NaN, Infinity, '1', null, {}, 9007199254740992]) {
    const calls = [];
    const c = client(calls, {});
    await assert.rejects(() => c.getContent('sc1', v));
    assert.equal(calls.length, 0);
  }
});
