/* MMU BeeBoard — classroom code decoder.
   Study@MMU の教室コード解説に基づく読み方（例 CQAR3002 → FCI · A Wing · Floor 3 ·
   Room 002 · Tutorial room）。表示専用で、保存する値はコードのまま。
   解釈できない入力は null を返し、呼び出し側は何も表示しない（推測で埋めない）。 */
(function (global) {
  'use strict';

  var CAMPUS = { C: 'Cyberjaya', M: 'Melaka' };
  var BUILDING = { Q: 'FCI', R: 'FOM', L: 'FAIE', J: 'FCM', N: 'CNMX' };
  var WING = { A: 'A Wing', B: 'B Wing', C: 'C Wing' };
  var ROOM_TYPE = { R: 'Tutorial room', X: 'Lecture room' };

  var PATTERN = /^[A-Z]{4}\d{3,4}$/;
  var SEPARATOR = ' · ';

  function normalize(code) {
    return String(code === undefined || code === null ? '' : code).trim().toUpperCase();
  }

  /* コードを要素へ分解する。形式が合わない、または未知の記号を含む場合は null。 */
  function decode(code) {
    var value = normalize(code);
    if (!PATTERN.test(value)) return null;

    var letters = value.slice(0, 4);
    var digits = value.slice(4);

    /* CNMX は大講義棟。Wing と部屋タイプを持たないので分解せず丸ごと扱う。 */
    if (letters === 'CNMX') {
      return {
        code: value,
        campus: CAMPUS.C,
        building: BUILDING.N,
        wing: null,
        floor: null,
        room: digits,
        type: null,
        special: true
      };
    }

    var campus = CAMPUS[letters.charAt(0)];
    var building = BUILDING[letters.charAt(1)];
    var wing = WING[letters.charAt(2)];
    var type = ROOM_TYPE[letters.charAt(3)];
    if (!campus || !building || !wing || !type) return null;

    return {
      code: value,
      campus: campus,
      building: building,
      wing: wing,
      floor: Number(digits.charAt(0)),
      room: digits.slice(1),
      type: type,
      special: false
    };
  }

  /* 表示用ラベル。解釈できない入力は null。 */
  function label(code) {
    var info = decode(code);
    if (!info) return null;
    if (info.special) return info.building + SEPARATOR + 'Room ' + info.room;
    return [
      info.building,
      info.wing,
      'Floor ' + info.floor,
      'Room ' + info.room,
      info.type
    ].join(SEPARATOR);
  }

  global.BB = global.BB || {};
  global.BB.room = { decode: decode, label: label };
})(window);
