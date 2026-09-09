import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Public source under test. Synthetic inputs only; no real data or keys.
// Only PropertiesService / SpreadsheetApp are doubled at the GAS boundary.
// Implementation under test is always loaded from the real .gs file via vm.
const SCHOOL_CONFIG_PATH = fileURLToPath(
  new URL('../../apps-script/SchoolConfig.gs', import.meta.url),
);
const SCHOOL_CONFIG_SOURCE = fs.readFileSync(SCHOOL_CONFIG_PATH, 'utf8');

function loadRealGetSpreadsheet({ scriptPropertiesFactory, activeFactory, openByIdFactory }) {
  const calls = { getScriptProperties: 0, getActiveSpreadsheet: 0, openById: 0 };
  const openByIdSeenIds = [];

  const PropertiesService = {
    getScriptProperties() {
      calls.getScriptProperties += 1;
      return scriptPropertiesFactory(calls);
    },
  };

  const SpreadsheetApp = {
    getActiveSpreadsheet() {
      calls.getActiveSpreadsheet += 1;
      return activeFactory(calls);
    },
    openById(id) {
      calls.openById += 1;
      openByIdSeenIds.push(id);
      return openByIdFactory(id, calls);
    },
  };

  const sandbox = { PropertiesService, SpreadsheetApp };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SCHOOL_CONFIG_SOURCE, sandbox, { filename: 'SchoolConfig.gs' });
  assert.strictEqual(typeof sandbox.getSpreadsheet_, 'function');
  return { getSpreadsheet_: sandbox.getSpreadsheet_, calls, openByIdSeenIds };
}

function stubScriptPropertiesWithValue(value) {
  return () => ({
    getProperty() {
      return value;
    },
    setProperty() {},
  });
}

describe('schoolconfig read safety (fail-closed binding)', () => {
  it('regression wrong-branch active fallback: getScriptProperties throws with active present must throw sanitized and never touch active/openById', () => {
    const sentinel = 'SENTINEL__SYNTHETIC_SCRIPT_PROPS_UNAVAILABLE__case01';
    const activeSheet = { __syntheticMarker: 'active-sheet-case01' };
    const mustNotBeReturned = { __syntheticMarker: 'must-not-be-returned-case01' };

    const { getSpreadsheet_, calls } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: () => {
        throw new Error(sentinel);
      },
      activeFactory: () => activeSheet,
      openByIdFactory: () => mustNotBeReturned,
    });

    let result = undefined;
    let thrown = null;
    try {
      result = getSpreadsheet_();
    } catch (err) {
      thrown = err;
    }

    assert.ok(
      thrown,
      'wrong-branch regression: returned active Sheet when script-properties read failed instead of throwing',
    );
    assert.ok(thrown && typeof thrown.message === 'string' && thrown.message.length > 0);
    assert.ok(
      !String(thrown.message).includes(sentinel),
      'public error must not leak raw sentinel from getScriptProperties',
    );
    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.getActiveSpreadsheet, 0);
    assert.strictEqual(calls.openById, 0);
  });

  it('regression wrong-branch active fallback: getProperty throws with active present must throw sanitized and never touch active/openById', () => {
    const sentinel = 'SENTINEL__SYNTHETIC_GET_PROPERTY_FAILURE__case02';
    const activeSheet = { __syntheticMarker: 'active-sheet-case02' };
    const mustNotBeReturned = { __syntheticMarker: 'must-not-be-returned-case02' };

    const { getSpreadsheet_, calls } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: () => ({
        getProperty() {
          throw new Error(sentinel);
        },
        setProperty() {},
      }),
      activeFactory: () => activeSheet,
      openByIdFactory: () => mustNotBeReturned,
    });

    let result = undefined;
    let thrown = null;
    try {
      result = getSpreadsheet_();
    } catch (err) {
      thrown = err;
    }

    assert.ok(
      thrown,
      'wrong-branch regression: returned active Sheet when property read failed instead of throwing',
    );
    assert.ok(thrown && typeof thrown.message === 'string' && thrown.message.length > 0);
    assert.ok(
      !String(thrown.message).includes(sentinel),
      'public error must not leak raw sentinel from getProperty',
    );
    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.getActiveSpreadsheet, 0);
    assert.strictEqual(calls.openById, 0);
  });

  it('regression wrong-branch active fallback: bound id readable but openById fails must throw and never fall back to active', () => {
    const boundId = 'synthetic-bound-id-case03';
    const activeSheet = { __syntheticMarker: 'active-sheet-case03' };

    const { getSpreadsheet_, calls, openByIdSeenIds } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: stubScriptPropertiesWithValue(boundId),
      activeFactory: () => activeSheet,
      openByIdFactory: () => {
        throw new Error('synthetic-openById-failure-case03');
      },
    });

    let result = undefined;
    let thrown = null;
    try {
      result = getSpreadsheet_();
    } catch (err) {
      thrown = err;
    }

    assert.ok(
      thrown,
      'wrong-branch regression: fell back to active Sheet when bound openById failed instead of throwing',
    );
    assert.ok(thrown && typeof thrown.message === 'string' && thrown.message.length > 0);
    assert.strictEqual(calls.openById, 1);
    assert.strictEqual(openByIdSeenIds[0], boundId);
    assert.strictEqual(calls.getActiveSpreadsheet, 0);
    assert.strictEqual(result, undefined);
    assert.notStrictEqual(result, activeSheet);
  });

  it('legacy active fallback: null property returns active Sheet without calling openById', () => {
    const activeSheet = { __syntheticMarker: 'active-sheet-case04-null' };
    const { getSpreadsheet_, calls } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: stubScriptPropertiesWithValue(null),
      activeFactory: () => activeSheet,
      openByIdFactory: () => ({ __syntheticMarker: 'must-not-be-returned-case04-null' }),
    });

    const result = getSpreadsheet_();
    assert.strictEqual(result, activeSheet);
    assert.strictEqual(calls.openById, 0);
    assert.strictEqual(calls.getActiveSpreadsheet, 1);
  });

  it('legacy active fallback: empty-string property returns active Sheet without calling openById', () => {
    const activeSheet = { __syntheticMarker: 'active-sheet-case04-empty' };
    const { getSpreadsheet_, calls } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: stubScriptPropertiesWithValue(''),
      activeFactory: () => activeSheet,
      openByIdFactory: () => ({ __syntheticMarker: 'must-not-be-returned-case04-empty' }),
    });

    const result = getSpreadsheet_();
    assert.strictEqual(result, activeSheet);
    assert.strictEqual(calls.openById, 0);
    assert.strictEqual(calls.getActiveSpreadsheet, 1);
  });

  it('bound id success: returns exact bound book and never queries active', () => {
    const boundId = 'synthetic-bound-id-case05';
    const boundBook = { __syntheticMarker: 'bound-book-case05' };
    const activeSheet = { __syntheticMarker: 'active-sheet-case05' };

    const { getSpreadsheet_, calls, openByIdSeenIds } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: stubScriptPropertiesWithValue(boundId),
      activeFactory: () => activeSheet,
      openByIdFactory: () => boundBook,
    });

    const result = getSpreadsheet_();
    assert.strictEqual(result, boundBook);
    assert.strictEqual(openByIdSeenIds[0], boundId);
    assert.strictEqual(calls.openById, 1);
    assert.strictEqual(calls.getActiveSpreadsheet, 0);
  });

  it('absent binding and absent active Sheet must throw', () => {
    const { getSpreadsheet_, calls } = loadRealGetSpreadsheet({
      scriptPropertiesFactory: stubScriptPropertiesWithValue(null),
      activeFactory: () => null,
      openByIdFactory: () => ({ __syntheticMarker: 'must-not-be-returned-case06' }),
    });

    let thrown = null;
    try {
      getSpreadsheet_();
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'expected throw when neither bound id nor active Sheet is available');
    assert.ok(thrown && typeof thrown.message === 'string' && thrown.message.length > 0);
    assert.strictEqual(calls.openById, 0);
    assert.strictEqual(calls.getActiveSpreadsheet, 1);
  });
});
