/**
 * 认证、员工、会话、固定日、任务
 * 若配置 Supabase（见 supabase-config.js），数据存云端；否则使用 localStorage。
 */
(function (global) {
  var AUTH_KEY = "studio_auth_ok";
  /** 登录有效时长（毫秒），超时需重新输入密码；每次进入受保护页面会续期 */
  var AUTH_TS_KEY = "studio_auth_ts";
  var AUTH_SESSION_MS = 5 * 60 * 1000;
  var EMP_KEY = "studio_employee";
  var SESSION_KEY = "studio_sessions";
  var CLOUD_SESSION_CACHE_KEY = "studio_cloud_sessions_cache";
  var SHIFT_MARK_KEY = "studio_session_shift_marks";
  var WEEK_CFG_KEY = "studio_week_fixed";
  var CLOUD_WEEK_CACHE_KEY = "studio_cloud_week_cache";
  var TASK_KEY = "studio_tasks";
  var CLOUD_TASK_CACHE_KEY = "studio_cloud_tasks_cache";
  var TASK_QUICK_KEY = "studio_task_quick_flags";
  /** 入口密码仅前端比对，无法防懂技术的访问者；真正保护数据需配合服务端校验或 Supabase Auth */
  var PASSWORD = "948223";

  function safeParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function getShiftMarkMap() {
    var m = safeParse(localStorage.getItem(SHIFT_MARK_KEY), {});
    return m && typeof m === "object" ? m : {};
  }
  function saveShiftMarkMap(map) {
    localStorage.setItem(SHIFT_MARK_KEY, JSON.stringify(map || {}));
  }
  function getQuickTaskMap() {
    var m = safeParse(localStorage.getItem(TASK_QUICK_KEY), {});
    return m && typeof m === "object" ? m : {};
  }
  function saveQuickTaskMap(map) {
    localStorage.setItem(TASK_QUICK_KEY, JSON.stringify(map || {}));
  }
  function emitDataUpdated() {
    if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent("studio:data-updated"));
    }
  }
  function loadCloudCacheToMemory() {
    _sessions = safeParse(localStorage.getItem(CLOUD_SESSION_CACHE_KEY), []).map(normalizeLocalSession);
    _tasks = safeParse(localStorage.getItem(CLOUD_TASK_CACHE_KEY), []).map(normalizeTask);
    _weekFixed = safeParse(localStorage.getItem(CLOUD_WEEK_CACHE_KEY), {});
  }
  function persistCloudCacheFromMemory() {
    localStorage.setItem(CLOUD_SESSION_CACHE_KEY, JSON.stringify(_sessions || []));
    localStorage.setItem(CLOUD_TASK_CACHE_KEY, JSON.stringify((_tasks || []).map(normalizeTask)));
    localStorage.setItem(CLOUD_WEEK_CACHE_KEY, JSON.stringify(_weekFixed || {}));
  }
  function refreshFromCloud(options) {
    if (!_sb) return Promise.resolve(false);
    var opts = options || {};
    var needSessions = opts.sessions !== false;
    var needTasks = opts.tasks !== false;
    var needWeek = opts.week !== false;
    var jobs = [];
    if (needSessions) {
      jobs.push(
        _sb.from("studio_sessions").select("*").order("starts_at", { ascending: true }).then(function (res) {
          if (res.error) throw res.error;
          _sessions = (res.data || []).map(mapSessionRow);
        })
      );
    }
    if (needTasks) {
      jobs.push(
        _sb.from("studio_tasks").select("*").then(function (res) {
          if (res.error) throw res.error;
          _tasks = (res.data || []).map(mapTaskRow);
        })
      );
    }
    if (needWeek) {
      jobs.push(
        _sb.from("studio_week_fixed").select("*").then(function (res) {
          if (res.error) throw res.error;
          _weekFixed = {};
          (res.data || []).forEach(function (row) {
            if (row.week_key && Array.isArray(row.days)) {
              _weekFixed[row.week_key] = row.days.map(Boolean);
            }
          });
        })
      );
    }
    if (jobs.length === 0) return Promise.resolve(true);
    return Promise.all(jobs).then(function () {
      persistCloudCacheFromMemory();
      emitDataUpdated();
      return true;
    });
  }

  function genId() {
    return Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }
  function nowMs() {
    return global.StudioClock && typeof global.StudioClock.nowMs === "function"
      ? global.StudioClock.nowMs()
      : Date.now();
  }
  function nowIso() {
    return global.StudioClock && typeof global.StudioClock.nowIso === "function"
      ? global.StudioClock.nowIso()
      : new Date().toISOString();
  }

  var SESSION_MAX_MS = 6 * 60 * 60 * 1000;
  var NOTE_MAX_LEN = 2000;

  function mapSessionRow(row) {
    return {
      id: row.id,
      employee: row.employee,
      start: row.starts_at,
      end: row.ends_at == null ? null : row.ends_at,
      note: row.work_note != null && row.work_note !== undefined ? String(row.work_note) : ""
    };
  }

  function normalizeLocalSession(s) {
    if (!s || typeof s !== "object") return s;
    return {
      id: s.id,
      employee: s.employee,
      start: s.start,
      end: s.end == null ? null : s.end,
      note: s.note != null ? String(s.note) : ""
    };
  }

  function replaceSessionInArray(arr, id, session) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        arr[i] = session;
        return i;
      }
    }
    return -1;
  }

  function mapTaskRow(row) {
    var owner = row.owner || row.employee || "U";
    if (owner !== "H" && owner !== "W") owner = "U";
    var priority = row.priority || "low";
    if (priority !== "high" && priority !== "medium" && priority !== "low" && priority !== "routine") priority = "low";
    var ddl = row.ddl_date || null;
    var scope = row.scope === "personal" ? "personal" : "studio";
    var repeatDays = Array.isArray(row.repeat_days)
      ? row.repeat_days.map(Boolean).slice(0, 7)
      : [false, false, false, false, false, false, false];
    return {
      id: row.id,
      owner: owner,
      text: row.content,
      priority: priority,
      ddlDate: ddl,
      scope: scope,
      repeatDays: repeatDays,
      done: !!row.done,
      createdAt: row.created_at || null,
      doneAt: row.done_at || null
    };
  }
  function isMissingColumnError(error, colName) {
    var msg = String((error && (error.message || error.details || error.hint)) || "");
    return msg.toLowerCase().indexOf(String(colName || "").toLowerCase()) >= 0;
  }

  function normalizeTask(t) {
    if (!t || typeof t !== "object") return t;
    var owner = t.owner || t.employee || "U";
    if (owner !== "H" && owner !== "W") owner = "U";
    var priority = t.priority || "low";
    if (priority !== "high" && priority !== "medium" && priority !== "low" && priority !== "routine") priority = "low";
    var repeatDays = Array.isArray(t.repeatDays)
      ? t.repeatDays.map(Boolean).slice(0, 7)
      : Array.isArray(t.repeat_days)
        ? t.repeat_days.map(Boolean).slice(0, 7)
        : [false, false, false, false, false, false, false];
    return {
      id: t.id,
      owner: owner,
      text: String(t.text || t.content || ""),
      priority: priority,
      ddlDate: t.ddlDate || t.ddl_date || null,
      scope: t.scope === "personal" ? "personal" : "studio",
      repeatDays: repeatDays,
      done: !!t.done,
      createdAt: t.createdAt || t.created_at || null,
      doneAt: t.doneAt || t.done_at || null
    };
  }

  var _initPromise = null;
  var _cloud = false;
  var _sb = null;
  var _sessions = [];
  var _tasks = [];
  var _weekFixed = {};

  function getCfg() {
    var c = global.__STUDIO_SUPABASE || {};
    return {
      url: (c.url || "").trim(),
      anonKey: (c.anonKey || "").trim()
    };
  }

  function createSb() {
    var cfg = getCfg();
    if (!cfg.url || !cfg.anonKey) return null;
    var root = global.supabase;
    var createClient =
      root &&
      (typeof root.createClient === "function"
        ? root.createClient
        : root.default && typeof root.default.createClient === "function"
          ? root.default.createClient
          : null);
    if (!createClient) {
      console.warn("Supabase JS 未加载或无法创建客户端，使用本地存储");
      return null;
    }
    return createClient(cfg.url, cfg.anonKey);
  }

  global.StudioStore = {
    AUTH_KEY: AUTH_KEY,
    AUTH_SESSION_MS: AUTH_SESSION_MS,
    PASSWORD: PASSWORD,

    /** 是否使用 Supabase（init 完成后有效） */
    isCloud: function () {
      return _cloud;
    },
    refreshCloudData: function (options) {
      if (!_cloud || !_sb) return Promise.resolve(false);
      return refreshFromCloud(options).catch(function (e) {
        console.error("手动刷新云端数据失败：", e);
        throw e;
      });
    },

    /**
     * 在使用 getSessions / 写入前，于 dashboard、report 页先调用。
     * @returns {Promise<void>}
     */
    init: function () {
      if (_initPromise) return _initPromise;
      var self = this;
      _initPromise = (function () {
        _sb = createSb();
        if (!_sb) {
          _cloud = false;
          return Promise.resolve();
        }
        _cloud = true;
        // 先用本地缓存秒开，再后台刷新云端数据。
        loadCloudCacheToMemory();
        refreshFromCloud({ sessions: true, tasks: true, week: true })
          .catch(function (e) {
            console.error("Supabase 后台刷新失败，继续使用缓存数据：", e);
          });
        return Promise.resolve();
      })();
      return _initPromise;
    },

    checkAuth: function () {
      if (sessionStorage.getItem(AUTH_KEY) !== "1") return false;
      var ts = parseInt(sessionStorage.getItem(AUTH_TS_KEY), 10);
      if (!ts || isNaN(ts)) {
        this.clearAuth();
        return false;
      }
      if (Date.now() - ts > AUTH_SESSION_MS) {
        this.clearAuth();
        return false;
      }
      return true;
    },
    /** 延长当前登录有效期（在已登录状态下调用） */
    touchAuth: function () {
      if (sessionStorage.getItem(AUTH_KEY) === "1") {
        sessionStorage.setItem(AUTH_TS_KEY, String(Date.now()));
      }
    },
    setAuth: function () {
      sessionStorage.setItem(AUTH_KEY, "1");
      sessionStorage.setItem(AUTH_TS_KEY, String(Date.now()));
    },
    clearAuth: function () {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_TS_KEY);
      sessionStorage.removeItem(EMP_KEY);
    },
    getEmployee: function () {
      return sessionStorage.getItem(EMP_KEY);
    },
    setEmployee: function (emp) {
      if (emp === "H" || emp === "W") {
        sessionStorage.setItem(EMP_KEY, emp);
      }
    },
    verifyPassword: function (input) {
      return String(input) === PASSWORD;
    },

    getSessions: function () {
      var raw;
      if (_cloud) raw = _sessions.slice();
      else {
        var arr = safeParse(localStorage.getItem(SESSION_KEY), []);
        raw = Array.isArray(arr) ? arr : [];
      }
      return raw.map(normalizeLocalSession);
    },

    markAllOpenSessionsTimeShifted: function () {
      var list = this.getSessions();
      var marks = getShiftMarkMap();
      var touched = 0;
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (s && s.id && !s.end) {
          marks[s.id] = (parseInt(marks[s.id], 10) || 0) + 1;
          touched++;
        }
      }
      if (touched > 0) saveShiftMarkMap(marks);
      return touched;
    },

    consumeTimeShiftMarkCount: function (sessionId) {
      if (!sessionId) return 0;
      var marks = getShiftMarkMap();
      var n = parseInt(marks[sessionId], 10) || 0;
      if (marks.hasOwnProperty(sessionId)) {
        delete marks[sessionId];
        saveShiftMarkMap(marks);
      }
      return n;
    },

    markTaskAsQuick: function (taskId) {
      if (!taskId) return;
      var map = getQuickTaskMap();
      map[taskId] = 1;
      saveQuickTaskMap(map);
    },

    isQuickTask: function (taskId) {
      if (!taskId) return false;
      var map = getQuickTaskMap();
      return !!map[taskId];
    },

    SESSION_MAX_MS: SESSION_MAX_MS,
    DISPLAY_12H_MS: 12 * 60 * 60 * 1000,

    /**
     * 单段最长 6h；自动为超时未下工的会话补上结束时间与备注
     * @returns {Promise<void>}
     */
    ensureSessionLimits: function () {
      var self = this;
      var list = _cloud ? _sessions : self.getSessions();
      var maxMs = SESSION_MAX_MS;
      var toClose = [];
      list.forEach(function (s) {
        if (s.end) return;
        var st = new Date(s.start).getTime();
        if (nowMs() - st >= maxMs) {
          toClose.push(s);
        }
      });
      if (toClose.length === 0) return Promise.resolve();
      var noteAuto = "（系统自动下工：单段已满6小时）";
      return toClose.reduce(function (chain, s) {
        return chain.then(function () {
          var endIso = new Date(new Date(s.start).getTime() + maxMs).toISOString();
          return self.forceEndSession(s.id, endIso, noteAuto);
        });
      }, Promise.resolve());
    },

    /**
     * 将未结束会话强制结束（用于超时）
     */
    forceEndSession: function (id, endIso, noteText) {
      var self = this;
      var list = _cloud ? _sessions : self.getSessions();
      var s = list.filter(function (x) {
        return x.id === id;
      })[0];
      if (!s || s.end) return Promise.resolve();
      var note = String(noteText || "").slice(0, NOTE_MAX_LEN);

      if (!_cloud) {
        var copy = self.getSessions().map(normalizeLocalSession);
        var idx = -1;
        for (var i = 0; i < copy.length; i++) {
          if (copy[i].id === id) {
            idx = i;
            break;
          }
        }
        if (idx < 0) return Promise.resolve();
        copy[idx].end = endIso;
        copy[idx].note = note;
        self.saveSessionsLocal(copy);
        return Promise.resolve();
      }

      return _sb
        .from("studio_sessions")
        .update({ ends_at: endIso, work_note: note })
        .eq("id", id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          replaceSessionInArray(_sessions, id, mapped);
          persistCloudCacheFromMemory();
        });
    },

    /**
     * 修改已结束会话的上/下工时间（时长不得超过 6h）
     */
    updateSessionTimes: function (id, startIso, endIso) {
      var self = this;
      var st = new Date(startIso).getTime();
      var en = new Date(endIso).getTime();
      if (!(st < en) || en - st > SESSION_MAX_MS) {
        return Promise.reject(new Error("时间无效：结束须晚于开始，且单段不超过6小时"));
      }
      var list = self.getSessions();
      var cur = list.filter(function (x) {
        return x.id === id;
      })[0];
      if (!cur || !cur.end) {
        return Promise.reject(new Error("只能修改已结束的会话"));
      }

      if (!_cloud) {
        var copy = list.map(normalizeLocalSession);
        for (var a = 0; a < copy.length; a++) {
          if (copy[a].id === id) {
            copy[a].start = startIso;
            copy[a].end = endIso;
            break;
          }
        }
        self.saveSessionsLocal(copy);
        return Promise.resolve();
      }

      return _sb
        .from("studio_sessions")
        .update({ starts_at: startIso, ends_at: endIso })
        .eq("id", id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          replaceSessionInArray(_sessions, id, mapped);
          persistCloudCacheFromMemory();
        });
    },

    /**
     * 修改未结束会话的上工时间
     */
    updateOpenSessionStart: function (id, startIso) {
      var self = this;
      var list = self.getSessions();
      var cur = list.filter(function (x) {
        return x.id === id;
      })[0];
      if (!cur || cur.end) {
        return Promise.reject(new Error("只能修改进行中的会话的上工时间"));
      }

      if (!_cloud) {
        var copy = list.map(normalizeLocalSession);
        for (var b = 0; b < copy.length; b++) {
          if (copy[b].id === id) {
            copy[b].start = startIso;
            break;
          }
        }
        self.saveSessionsLocal(copy);
        return Promise.resolve();
      }

      return _sb
        .from("studio_sessions")
        .update({ starts_at: startIso })
        .eq("id", id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          replaceSessionInArray(_sessions, id, mapped);
          persistCloudCacheFromMemory();
        });
    },

    saveSessionsLocal: function (list) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(list));
    },

    getOpenSession: function (employee) {
      var list = this.getSessions();
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].employee === employee && !list[i].end) return list[i];
      }
      return null;
    },

    /**
     * @returns {Promise<{id,employee,start,end}|null>}
     */
    startSession: function (employee) {
      var self = this;
      if (employee !== "H" && employee !== "W") {
        return Promise.resolve(null);
      }
      if (self.getOpenSession(employee)) {
        return Promise.resolve(null);
      }
      var id = genId();
      var startIso = nowIso();
      var rec = { id: id, employee: employee, start: startIso, end: null, note: "" };

      if (!_cloud) {
        var list = self.getSessions();
        list.push(rec);
        self.saveSessionsLocal(list);
        return Promise.resolve(rec);
      }

      return _sb
        .from("studio_sessions")
        .insert({
          id: id,
          employee: employee,
          starts_at: startIso,
          ends_at: null,
          work_note: null
        })
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          _sessions.push(mapped);
          persistCloudCacheFromMemory();
          return mapped;
        });
    },

    /**
     * @param {string} workNote 下工时填写的工作内容（简要）
     * @returns {Promise<{id,employee,start,end,note}|null>}
     */
    endSession: function (employee, workNote) {
      var self = this;
      var list = self.getSessions();
      var open = null;
      var idx = -1;
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].employee === employee && !list[i].end) {
          open = list[i];
          idx = i;
          break;
        }
      }
      if (!open) return Promise.resolve(null);
      var startMs = new Date(open.start).getTime();
      var capMs = startMs + SESSION_MAX_MS;
      var endIso = new Date(Math.min(nowMs(), capMs)).toISOString();
      var note = String(workNote != null ? workNote : "").trim().slice(0, NOTE_MAX_LEN);
      var shiftCount = self.consumeTimeShiftMarkCount(open.id);
      if (shiftCount > 0) {
        var shiftTag = "（本段使用测试时钟偏移 " + shiftCount + " 次）";
        note = (note ? note + " " : "") + shiftTag;
        note = note.slice(0, NOTE_MAX_LEN);
      }

      if (!_cloud) {
        var copy = list.map(normalizeLocalSession);
        for (var j = 0; j < copy.length; j++) {
          if (copy[j].id === open.id) {
            copy[j].end = endIso;
            copy[j].note = note;
            break;
          }
        }
        self.saveSessionsLocal(copy);
        return Promise.resolve(
          Object.assign({}, open, { end: endIso, note: note })
        );
      }

      return _sb
        .from("studio_sessions")
        .update({ ends_at: endIso, work_note: note || null })
        .eq("id", open.id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          if (idx >= 0 && idx < _sessions.length) {
            _sessions[idx] = mapped;
          } else {
            for (var k = 0; k < _sessions.length; k++) {
              if (_sessions[k].id === open.id) {
                _sessions[k] = mapped;
                break;
              }
            }
          }
          persistCloudCacheFromMemory();
          return mapped;
        });
    },

    getWeekKey: function (date) {
      var mon = this.mondayOfWeek(date);
      var y = mon.getFullYear();
      var w1 = this.mondayOfWeek(new Date(y, 0, 4));
      var ms = mon - w1;
      var n = Math.round(ms / 604800000) + 1;
      if (n < 1) {
        y--;
        w1 = this.mondayOfWeek(new Date(y, 0, 4));
        ms = mon - w1;
        n = Math.round(ms / 604800000) + 1;
      }
      return y + "-W" + String(n).padStart(2, "0");
    },

    mondayOfWeek: function (d) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var day = x.getDay();
      var diff = day === 0 ? -6 : 1 - day;
      x.setDate(x.getDate() + diff);
      x.setHours(0, 0, 0, 0);
      return x;
    },

    getFixedDaysForWeek: function (weekKey) {
      if (_cloud) {
        var a = _weekFixed[weekKey];
        if (Array.isArray(a) && a.length === 7) return a.slice();
        return [true, true, true, true, true, false, false];
      }
      var all = safeParse(localStorage.getItem(WEEK_CFG_KEY), {});
      var arr = all[weekKey];
      if (Array.isArray(arr) && arr.length === 7) return arr.slice();
      return [true, true, true, true, true, false, false];
    },

    /**
     * @returns {Promise<boolean>}
     */
    setFixedDaysForWeek: function (weekKey, days7) {
      var self = this;
      if (!Array.isArray(days7) || days7.length !== 7) {
        return Promise.resolve(false);
      }
      var c = 0;
      for (var i = 0; i < 7; i++) if (days7[i]) c++;
      if (c !== 5) return Promise.resolve(false);
      var normalized = days7.map(Boolean);

      if (!_cloud) {
        var all = safeParse(localStorage.getItem(WEEK_CFG_KEY), {});
        all[weekKey] = normalized;
        localStorage.setItem(WEEK_CFG_KEY, JSON.stringify(all));
        return Promise.resolve(true);
      }

      return _sb
        .from("studio_week_fixed")
        .upsert(
          { week_key: weekKey, days: normalized },
          { onConflict: "week_key" }
        )
        .then(function (res) {
          if (res.error) throw res.error;
          _weekFixed[weekKey] = normalized.slice();
          persistCloudCacheFromMemory();
          return true;
        })
        .catch(function (e) {
          console.error(e);
          return false;
        });
    },

    getTasks: function () {
      if (_cloud) return _tasks.slice().map(normalizeTask);
      var arr = safeParse(localStorage.getItem(TASK_KEY), []);
      return (Array.isArray(arr) ? arr : []).map(normalizeTask);
    },

    saveTasksLocal: function (tasks) {
      localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
    },

    /**
     * @returns {Promise<object|null>}
     */
    addTask: function (owner, text, priority, ddlDate, options) {
      var t = String(text || "").trim();
      if (!t) return Promise.resolve(null);
      if (owner !== "H" && owner !== "W") owner = "U";
      if (priority !== "high" && priority !== "medium" && priority !== "low" && priority !== "routine") priority = "low";
      var ddl = priority === "low" || priority === "routine" ? null : ddlDate || null;
      var scope = options && options.scope === "personal" ? "personal" : "studio";
      var repeatDays = [false, false, false, false, false, false, false];
      if (priority === "routine" && options && Array.isArray(options.repeatDays)) {
        repeatDays = options.repeatDays.map(Boolean).slice(0, 7);
      }
      var createdAt = nowIso();
      var id = genId();
      var item = {
        id: id,
        owner: owner,
        text: t,
        priority: priority,
        ddlDate: ddl,
        scope: scope,
        repeatDays: repeatDays,
        done: false,
        createdAt: createdAt,
        doneAt: null
      };

      if (!_cloud) {
        var list = this.getTasks();
        list.push(item);
        this.saveTasksLocal(list);
        return Promise.resolve(item);
      }

      function insertWith(payload) {
        return _sb.from("studio_tasks").insert(payload).select().single();
      }
      var fullPayload = {
        id: id,
        owner: owner,
        employee: owner === "U" ? "H" : owner,
        content: t,
        priority: priority,
        ddl_date: ddl,
        scope: scope,
        repeat_days: repeatDays,
        done: false,
        created_at: createdAt,
        done_at: null
      };
      return insertWith(fullPayload)
        .then(function (res) {
          if (res.error) throw res.error;
          return res;
        })
        .catch(function (err) {
          if (isMissingColumnError(err, "repeat_days") || isMissingColumnError(err, "scope")) {
            var fallbackPayload = {
              id: id,
              owner: owner,
              employee: owner === "U" ? "H" : owner,
              content: t,
              priority: priority,
              ddl_date: ddl,
              done: false,
              created_at: createdAt,
              done_at: null
            };
            return insertWith(fallbackPayload).then(function (res2) {
              if (res2.error) throw res2.error;
              return res2;
            });
          }
          throw err;
        })
        .then(function (res) {
          var mapped = mapTaskRow(res.data);
          _tasks.push(mapped);
          persistCloudCacheFromMemory();
          return mapped;
        });
    },

    /**
     * @returns {Promise<void>}
     */
    toggleTask: function (id) {
      var self = this;
      if (!_cloud) {
        var now = nowIso();
        var list = self.getTasks().map(function (x) {
          if (x.id !== id) return x;
          var nextDone = !x.done;
          return x.id === id
            ? {
                id: x.id,
                owner: x.owner,
                text: x.text,
                priority: x.priority || "low",
                ddlDate: x.ddlDate || null,
                scope: x.scope === "personal" ? "personal" : "studio",
                repeatDays: Array.isArray(x.repeatDays) ? x.repeatDays.slice(0, 7) : [false, false, false, false, false, false, false],
                done: nextDone,
                createdAt: x.createdAt || null,
                doneAt: nextDone ? now : null
              }
            : x;
        });
        self.saveTasksLocal(list);
        return Promise.resolve();
      }
      var cur = _tasks.filter(function (x) {
        return x.id === id;
      })[0];
      if (!cur) return Promise.resolve();
      var next = !cur.done;
      return _sb
        .from("studio_tasks")
        .update({ done: next, done_at: next ? nowIso() : null })
        .eq("id", id)
        .then(function (res) {
          if (res.error) throw res.error;
          _tasks = _tasks.map(function (x) {
            return x.id === id
              ? {
                  id: x.id,
                  owner: x.owner,
                  text: x.text,
                  priority: x.priority || "low",
                  ddlDate: x.ddlDate || null,
                  scope: x.scope === "personal" ? "personal" : "studio",
                  repeatDays: Array.isArray(x.repeatDays) ? x.repeatDays.slice(0, 7) : [false, false, false, false, false, false, false],
                  done: next,
                  createdAt: x.createdAt || null,
                  doneAt: next ? nowIso() : null
                }
              : x;
          });
          persistCloudCacheFromMemory();
        });
    },

    /**
     * @returns {Promise<void>}
     */
    deleteTask: function (id) {
      var self = this;
      var quickMap = getQuickTaskMap();
      if (quickMap.hasOwnProperty(id)) {
        delete quickMap[id];
        saveQuickTaskMap(quickMap);
      }
      if (!_cloud) {
        self.saveTasksLocal(
          self.getTasks().filter(function (x) {
            return x.id !== id;
          })
        );
        return Promise.resolve();
      }
      return _sb
        .from("studio_tasks")
        .delete()
        .eq("id", id)
        .then(function (res) {
          if (res.error) throw res.error;
          _tasks = _tasks.filter(function (x) {
            return x.id !== id;
          });
          persistCloudCacheFromMemory();
        });
    },

    /**
     * 修改任务负责人（H/W/待认领）
     * @returns {Promise<void>}
     */
    updateTaskOwner: function (id, owner) {
      var self = this;
      var nextOwner = owner === "H" || owner === "W" ? owner : "U";
      if (!_cloud) {
        var list = self.getTasks().map(function (x) {
          if (x.id !== id) return x;
          return {
            id: x.id,
            owner: nextOwner,
            text: x.text,
            priority: x.priority || "low",
            ddlDate: x.ddlDate || null,
            scope: x.scope === "personal" ? "personal" : "studio",
            repeatDays: Array.isArray(x.repeatDays) ? x.repeatDays.slice(0, 7) : [false, false, false, false, false, false, false],
            done: !!x.done,
            createdAt: x.createdAt || null,
            doneAt: x.doneAt || null
          };
        });
        self.saveTasksLocal(list);
        return Promise.resolve();
      }

      function applyLocalShadow() {
        _tasks = _tasks.map(function (x) {
          if (x.id !== id) return x;
          return {
            id: x.id,
            owner: nextOwner,
            text: x.text,
            priority: x.priority || "low",
            ddlDate: x.ddlDate || null,
            scope: x.scope === "personal" ? "personal" : "studio",
            repeatDays: Array.isArray(x.repeatDays) ? x.repeatDays.slice(0, 7) : [false, false, false, false, false, false, false],
            done: !!x.done,
            createdAt: x.createdAt || null,
            doneAt: x.doneAt || null
          };
        });
      }

      return _sb
        .from("studio_tasks")
        .update({ owner: nextOwner, employee: nextOwner === "U" ? "H" : nextOwner })
        .eq("id", id)
        .then(function (res) {
          if (res.error) throw res.error;
          applyLocalShadow();
        })
        .catch(function (err) {
          if (isMissingColumnError(err, "owner")) {
            return _sb
              .from("studio_tasks")
              .update({ employee: nextOwner === "U" ? "H" : nextOwner })
              .eq("id", id)
              .then(function (res2) {
                if (res2.error) throw res2.error;
                applyLocalShadow();
                persistCloudCacheFromMemory();
              });
          }
          throw err;
        })
        .then(function () {
          persistCloudCacheFromMemory();
        });
    }
  };
})(typeof window !== "undefined" ? window : this);
