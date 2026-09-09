import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleAuth, createMemoryTokenStore } from '../src/auth/google-auth.mjs';

// Custom scopes avoid deciding email/profile alias mapping here.
// Parent directs implementation later from official Google docs.
const TEST_SCOPES = ['openid', 'scope-a', 'scope-b'];
const FAKE_CLIENT_ID = 'synthetic-test-client.apps.googleusercontent.com';
const SYNTHETIC_TOKEN = 'synthetic-test-token-aaa';
const SYNTHETIC_TOKEN_B = 'synthetic-test-token-bbb';
const SYNTHETIC_TOKEN_C = 'synthetic-test-token-ccc';
const SYNTHETIC_TOKEN_D = 'synthetic-test-token-ddd';

function makeControllableGis() {
  const state = { next: null, revokeCalls: [] };
  const gis = {
    accounts: {
      oauth2: {
        initTokenClient({ callback, error_callback }) {
          return {
            requestAccessToken() {
              const programmed = state.next;
              if (!programmed) {
                throw new Error('fake GIS response not programmed');
              }
              if (programmed.kind === 'success') {
                callback(programmed.payload);
              } else if (programmed.kind === 'denied') {
                callback(programmed.payload);
              } else if (programmed.kind === 'popup-error') {
                error_callback(programmed.error);
              }
            },
          };
        },
        revoke(token, done) {
          state.revokeCalls.push(token);
          if (typeof done === 'function') done();
        },
      },
    },
    _state: state,
  };
  return gis;
}

function makeAuth(gis, scopes = TEST_SCOPES) {
  return createGoogleAuth({
    gis,
    store: createMemoryTokenStore(),
    clientId: FAKE_CLIENT_ID,
    scopes: [...scopes],
  });
}

describe('auth grant safety (fake GIS boundary, synthetic tokens)', () => {
  it('incomplete/missing granted scope response must reject and leave getToken null', async () => {
    const gisPartial = makeControllableGis();
    gisPartial._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN, scope: 'openid scope-a', expires_in: 3600 },
    };
    const partialAuth = makeAuth(gisPartial);
    await assert.rejects(() => partialAuth.requestAccess({}));
    assert.equal(partialAuth.getToken(), null);

    const gisMissing = makeControllableGis();
    gisMissing._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN, expires_in: 3600 },
    };
    const missingAuth = makeAuth(gisMissing);
    await assert.rejects(() => missingAuth.requestAccess({}));
    assert.equal(missingAuth.getToken(), null);
  });

  it('grantedScopes starts empty, equals actual returned grants after full approval, revoke clears', async () => {
    const gis = makeControllableGis();
    const auth = makeAuth(gis);
    assert.deepEqual(auth.grantedScopes(), []);

    gis._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN, scope: 'scope-b openid scope-a', expires_in: 3600 },
    };
    await auth.requestAccess({});
    assert.equal(auth.getToken(), SYNTHETIC_TOKEN);
    assert.deepEqual([...auth.grantedScopes()].sort(), ['openid', 'scope-a', 'scope-b'].sort());

    auth.revoke();
    assert.equal(auth.getToken(), null);
    assert.deepEqual(auth.grantedScopes(), []);
  });

  it('failure after full success cannot leave old usable token', async () => {
    const gis = makeControllableGis();
    const auth = makeAuth(gis);

    gis._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN_B, scope: 'openid scope-a scope-b', expires_in: 3600 },
    };
    await auth.requestAccess({});
    assert.equal(auth.getToken(), SYNTHETIC_TOKEN_B);

    gis._state.next = { kind: 'denied', payload: { error: 'access_denied' } };
    await assert.rejects(() => auth.requestAccess({}));
    assert.equal(auth.getToken(), null);

    gis._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN_C, scope: 'openid scope-a scope-b', expires_in: 3600 },
    };
    await auth.requestAccess({});
    assert.equal(auth.getToken(), SYNTHETIC_TOKEN_C);

    gis._state.next = { kind: 'popup-error', error: { message: 'popup_closed_by_user' } };
    await assert.rejects(() => auth.requestAccess({}));
    assert.equal(auth.getToken(), null);

    gis._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN_D, scope: 'openid scope-a scope-b', expires_in: 3600 },
    };
    await auth.requestAccess({});
    assert.equal(auth.getToken(), SYNTHETIC_TOKEN_D);

    gis._state.next = {
      kind: 'success',
      payload: { access_token: 'synthetic-test-token-partial', scope: 'openid scope-a', expires_in: 3600 },
    };
    await assert.rejects(() => auth.requestAccess({}));
    assert.equal(auth.getToken(), null);
  });

  it('email/profile URL alias full grant succeeds, missing alias fails', async () => {
    const EMAIL_URL = 'https://www.googleapis.com/auth/userinfo.email';
    const PROFILE_URL = 'https://www.googleapis.com/auth/userinfo.profile';
    const gisFull = makeControllableGis();
    gisFull._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN, scope: `openid ${EMAIL_URL} profile`, expires_in: 3600 },
    };
    const fullAuth = makeAuth(gisFull, ['openid', 'email', PROFILE_URL]);
    await fullAuth.requestAccess({});
    assert.equal(fullAuth.getToken(), SYNTHETIC_TOKEN);
    assert.deepEqual([...fullAuth.grantedScopes()].sort(), ['openid', EMAIL_URL, 'profile'].sort());

    const gisPartial = makeControllableGis();
    gisPartial._state.next = {
      kind: 'success',
      payload: { access_token: SYNTHETIC_TOKEN_B, scope: `openid ${EMAIL_URL}`, expires_in: 3600 },
    };
    const partialAuth = makeAuth(gisPartial, ['openid', 'email', 'profile']);
    await assert.rejects(() => partialAuth.requestAccess({}));
    assert.equal(partialAuth.getToken(), null);
    assert.deepEqual(partialAuth.grantedScopes(), []);
  });
});
