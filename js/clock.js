/**
 * 可控时钟：默认使用真实时间；测试时可设置偏移并快速推进。
 */
(function (global) {
  var KEY = "studio_clock_offset_ms";

  function readOffset() {
    try {
      var raw = localStorage.getItem(KEY);
      var n = parseInt(raw, 10);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }

  function writeOffset(ms) {
    try {
      localStorage.setItem(KEY, String(ms));
    } catch (e) {
      // ignore
    }
  }

  var offsetMs = readOffset();

  function nowMs() {
    return Date.now() + offsetMs;
  }

  global.StudioClock = {
    nowMs: nowMs,
    now: function () {
      return new Date(nowMs());
    },
    nowIso: function () {
      return new Date(nowMs()).toISOString();
    },
    getOffsetMs: function () {
      return offsetMs;
    },
    setOffsetMs: function (ms) {
      offsetMs = Number(ms) || 0;
      writeOffset(offsetMs);
      return offsetMs;
    },
    advanceMs: function (ms) {
      offsetMs += Number(ms) || 0;
      writeOffset(offsetMs);
      return offsetMs;
    },
    reset: function () {
      offsetMs = 0;
      writeOffset(offsetMs);
      return offsetMs;
    }
  };
})(typeof window !== "undefined" ? window : this);
