/**
 * QrTokens.gs — 결정적 QR 토큰 (HMAC, 재인쇄 가능)
 *
 * 토큰 = HMAC_SHA256(학교 비밀키, room_id + ':' + token_version) hex 앞 48자.
 * - 실 이름 변경은 version을 그대로 두므로 기존 QR이 계속 작동한다.
 * - 재인쇄는 같은 토큰을 다시 계산하므로 QR이 바뀌지 않는다.
 * - 명시적 재발급은 version+1 → 이전 토큰 즉시 무효.
 * - 비밀키는 학교 ScriptProperties에만 저장하고 응답·CSV·로그에 노출하지 않는다.
 * - 기존 랜덤 토큰 hash(submit_token_hash)도 fallback으로 인정한다 (재발급 시 HMAC으로 수렴).
 */

function ensureQrSecret_() {
  var secret = schoolProp_('qr_hmac_secret', '');
  if (!secret) {
    secret = sha256_(uuid_('qr-secret') + '|' + nowIso_() + '|' + uuid_('qr-salt'));
    setSchoolProp_('qr_hmac_secret', secret);
  }
  return secret;
}

function roomToken_(roomId, version) {
  var secret = ensureQrSecret_();
  var data = String(roomId) + ':' + String(version);
  var mac = Utilities.computeHmacSha256Signature(data, secret, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < mac.length; i++) {
    var v = (mac[i] < 0 ? mac[i] + 256 : mac[i]).toString(16);
    hex += v.length === 1 ? '0' + v : v;
  }
  return hex.slice(0, 48);
}

function validateRoomToken_(roomId, submitToken) {
  var room = findBy_('settings_rooms', 'room_id', roomId);
  if (!room || !activeRow_(room)) {
    logAudit_('anonymous', 'submit_token_failed', 'room', roomId, { reason: 'no_room' });
    throw new Error('유효하지 않은 QR 코드입니다.');
  }
  var ok = false;
  if (submitToken) {
    try {
      ok = constantTimeEquals_(String(submitToken), roomToken_(room.room_id, tokenVersion_(room)));
    } catch (secretErr) {
      ok = false;
    }
    if (!ok) {
      var legacy = String(room.submit_token_hash || '');
      if (legacy) {
        try {
          ok = constantTimeEquals_(hashToken_(submitToken, room.room_id), legacy);
        } catch (legacyErr) {
          ok = false;
        }
      }
    }
  }
  if (!ok) {
    logAudit_('anonymous', 'submit_token_failed', 'room', roomId, {});
    throw new Error('유효하지 않은 QR 코드입니다.');
  }
  return room;
}
