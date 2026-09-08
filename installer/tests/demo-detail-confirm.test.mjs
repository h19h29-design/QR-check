import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createSampleStore } from '../demo/sample-store.mjs';
import { renderList, showDetail } from '../demo/demo.js';

function makeNode(tag) {
  const node = {
    tag,
    children: [],
    attrs: {},
    listeners: {},
    textContent: '',
    value: '',
    disabled: false,
    hidden: false,
    appendChild(child) {
      node.children.push(child);
      return child;
    },
    removeChild(child) {
      const i = node.children.indexOf(child);
      if (i !== -1) node.children.splice(i, 1);
      return child;
    },
    setAttribute(key, value) {
      node.attrs[String(key)] = String(value);
    },
    getAttribute(key) {
      return key in node.attrs ? node.attrs[key] : null;
    },
    addEventListener(type, fn) {
      if (!node.listeners[type]) node.listeners[type] = [];
      node.listeners[type].push(fn);
    },
    click() {
      for (const fn of node.listeners.click || []) fn();
    },
  };
  Object.defineProperty(node, 'firstChild', {
    get() {
      return node.children[0] || null;
    },
  });
  return node;
}

function makeDoc(ids) {
  const nodes = {};
  for (const [id, node] of Object.entries(ids)) nodes[id] = node;
  return {
    nodes,
    getElementById(id) {
      return nodes[id] || null;
    },
    createElement(tag) {
      return makeNode(tag);
    },
  };
}

function rowButtons(row) {
  const actionCell = row.children[row.children.length - 1];
  return actionCell.children.filter((c) => c.tag === 'button');
}

function setup() {
  const store = createSampleStore('detail-first');
  const body = makeNode('tbody');
  const dateFilter = makeNode('input');
  dateFilter.value = '';
  const statusFilter = makeNode('select');
  statusFilter.value = '';
  const panel = makeNode('div');
  const doc = makeDoc({
    'records-body': body,
    'admin-date': dateFilter,
    'admin-status': statusFilter,
    'detail-panel': panel,
  });
  return { store, doc, body, panel };
}

describe('ISSUE detail-before-confirm', () => {
  it('ISSUE rows offer detail only; OK rows keep direct confirm', () => {
    const { store, doc, body } = setup();
    renderList(doc, store);
    assert.equal(body.children.length, 2);
    const byStatus = {};
    for (const row of body.children) {
      const statusCell = row.children[4];
      byStatus[statusCell.textContent] = row;
    }
    const issueButtons = rowButtons(byStatus['조치 필요(샘플)']);
    assert.equal(issueButtons.length, 1);
    assert.equal(issueButtons[0].getAttribute('data-record-id') !== null, true);
    assert.equal(issueButtons[0].getAttribute('data-confirm-id'), null);
    const okButtons = rowButtons(byStatus['정상(샘플)']);
    assert.equal(okButtons.length, 2);
    assert.ok(okButtons.some((b) => b.getAttribute('data-confirm-id') !== null));
  });

  it('ISSUE confirmation happens only via the opened detail view', () => {
    const { store, doc, body, panel } = setup();
    renderList(doc, store);
    const issue = store.listRecords({ status: 'ISSUE' })[0];
    assert.equal(issue.confirmed, false);
    const issueRow = body.children.find((row) =>
      rowButtons(row).some((b) => b.getAttribute('data-record-id') === issue.id),
    );
    assert.ok(issueRow, 'ISSUE row must exist');
    const detailBtn = rowButtons(issueRow)[0];
    detailBtn.click();
    // Opening detail must not confirm by itself.
    assert.equal(store.getRecord(issue.id).confirmed, false);
    const confirmBtn = panel.children.find((c) => c.tag === 'button');
    assert.ok(confirmBtn, 'detail view must offer explicit confirm');
    confirmBtn.click();
    assert.equal(store.getRecord(issue.id).confirmed, true);
  });

  it('empty filter renders a readable empty state', () => {
    const { store, doc, body } = setup();
    renderList(doc, store, undefined);
    // Force an empty result through a non-matching date filter.
    doc.nodes['admin-date'].value = '2099-01-01';
    renderList(doc, store);
    assert.equal(body.children.length, 1);
    const cell = body.children[0].children[0];
    assert.equal(cell.getAttribute('colspan'), '7');
    assert.ok(String(cell.textContent).length > 0);
  });

  it('showDetail exposes an explicit confirm affordance for unconfirmed records', () => {
    const { store, doc, panel } = setup();
    const ok = store.listRecords({ status: 'OK' })[0];
    showDetail(doc, store, ok.id);
    const confirmBtn = panel.children.find((c) => c.tag === 'button');
    assert.ok(confirmBtn, 'unconfirmed detail must offer explicit confirm');
  });
});
