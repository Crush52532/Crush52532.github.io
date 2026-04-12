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
  var WEEK_CFG_KEY = "studio_week_fixed";
  var TASK_KEY = "studio_tasks";
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

  function genId() {
    return Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function mapSessionRow(row) {
    return {
      id: row.id,
      employee: row.employee,
      start: row.starts_at,
      end: row.ends_at == null ? null : row.ends_at
    };
  }

  function mapTaskRow(row) {
    return {
      id: row.id,
      employee: row.employee,
      text: row.content,
      done: !!row.done
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
        return Promise.all([
          _sb.from("studio_sessions").select("*").order("starts_at", { ascending: true }),
          _sb.from("studio_tasks").select("*"),
          _sb.from("studio_week_fixed").select("*")
        ])
          .then(function (results) {
            if (results[0].error) throw results[0].error;
            if (results[1].error) throw results[1].error;
            if (results[2].error) throw results[2].error;
            _sessions = (results[0].data || []).map(mapSessionRow);
            _tasks = (results[1].data || []).map(mapTaskRow);
            _weekFixed = {};
            (results[2].data || []).forEach(function (row) {
              if (row.week_key && Array.isArray(row.days)) {
                _weekFixed[row.week_key] = row.days.map(Boolean);
              }
            });
            _cloud = true;
          })
          .catch(function (e) {
            console.error("Supabase 初始化失败，回退本地存储：", e);
            _cloud = false;
            _sb = null;
            _sessions = [];
            _tasks = [];
            _weekFixed = {};
          });
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
      if (_cloud) return _sessions.slice();
      var arr = safeParse(localStorage.getItem(SESSION_KEY), []);
      return Array.isArray(arr) ? arr : [];
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
      var startIso = new Date().toISOString();
      var rec = { id: id, employee: employee, start: startIso, end: null };

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
          ends_at: null
        })
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          _sessions.push(mapped);
          return mapped;
        });
    },

    /**
     * @returns {Promise<{id,employee,start,end}|null>}
     */
    endSession: function (employee) {
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
      var endIso = new Date().toISOString();

      if (!_cloud) {
        open.end = endIso;
        self.saveSessionsLocal(list);
        return Promise.resolve(open);
      }

      return _sb
        .from("studio_sessions")
        .update({ ends_at: endIso })
        .eq("id", open.id)
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapSessionRow(res.data);
          if (idx >= 0 && idx < _sessions.length) {
            _sessions[idx] = mapped;
          } else {
            for (var j = 0; j < _sessions.length; j++) {
              if (_sessions[j].id === open.id) {
                _sessions[j] = mapped;
                break;
              }
            }
          }
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
          return true;
        })
        .catch(function (e) {
          console.error(e);
          return false;
        });
    },

    getTasks: function () {
      if (_cloud) return _tasks.slice();
      var arr = safeParse(localStorage.getItem(TASK_KEY), []);
      return Array.isArray(arr) ? arr : [];
    },

    saveTasksLocal: function (tasks) {
      localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
    },

    /**
     * @returns {Promise<object|null>}
     */
    addTask: function (employee, text) {
      var t = String(text || "").trim();
      if (!t) return Promise.resolve(null);
      var id = genId();
      var item = { id: id, employee: employee, text: t, done: false };

      if (!_cloud) {
        var list = this.getTasks();
        list.push(item);
        this.saveTasksLocal(list);
        return Promise.resolve(item);
      }

      return _sb
        .from("studio_tasks")
        .insert({
          id: id,
          employee: employee,
          content: t,
          done: false
        })
        .select()
        .single()
        .then(function (res) {
          if (res.error) throw res.error;
          var mapped = mapTaskRow(res.data);
          _tasks.push(mapped);
          return mapped;
        });
    },

    /**
     * @returns {Promise<void>}
     */
    toggleTask: function (id) {
      var self = this;
      if (!_cloud) {
        var list = self.getTasks().map(function (x) {
          return x.id === id
            ? { id: x.id, employee: x.employee, text: x.text, done: !x.done }
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
        .update({ done: next })
        .eq("id", id)
        .then(function (res) {
          if (res.error) throw res.error;
          _tasks = _tasks.map(function (x) {
            return x.id === id ? { id: x.id, employee: x.employee, text: x.text, done: next } : x;
          });
        });
    },

    /**
     * @returns {Promise<void>}
     */
    deleteTask: function (id) {
      var self = this;
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
        });
    }
  };
})(typeof window !== "undefined" ? window : this);
