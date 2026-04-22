(function () {
  var S = window.StudioStore;
  var W = window.Worktime;
  var C = window.StudioClock;
  if (!S || !W) return;
  if (!C) {
    C = {
      now: function () {
        return new Date();
      },
      nowMs: function () {
        return Date.now();
      },
      getOffsetMs: function () {
        return 0;
      },
      advanceMs: function () {},
      reset: function () {}
    };
  }

  var img = new Image();
  img.onload = function () {
    var el = document.getElementById("pageBg");
    if (el) el.classList.remove("no-img");
  };
  img.onerror = function () {
    var el = document.getElementById("pageBg");
    if (el) el.classList.add("no-img");
  };
  img.src = "1.png";

  if (!S.checkAuth()) {
    window.location.href = "index.html";
    return;
  }

  var emp = S.getEmployee();
  if (emp !== "H" && emp !== "W") {
    window.location.href = "select.html";
    return;
  }

  S.init()
    .then(function () {
      return S.ensureSessionLimits();
    })
    .then(function () {
      runDashboard();
    })
    .catch(function (e) {
      console.error(e);
      runDashboard();
    });

  function runDashboard() {
  S.touchAuth();
  document.body.classList.add(emp === "H" ? "theme-h" : "theme-w");

  var badge = document.getElementById("empBadge");
  if (badge) {
    badge.textContent = "当前：" + emp + (S.isCloud() ? " · 云端" : " · 本地");
    badge.classList.add(emp === "H" ? "h" : "w");
  }
  if (!S.isCloud()) {
    ["btnRefreshWorkbench", "btnRefreshStudioTasks", "btnRefreshDailyTasks"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.style.display = "none";
    });
  }

  document.getElementById("btnLogout").addEventListener("click", function () {
    S.clearAuth();
    window.location.href = "index.html";
  });

  var viewYear = C.now().getFullYear();
  var viewMonth = C.now().getMonth();
  var calDow = document.getElementById("calDow");
  var calDays = document.getElementById("calDays");
  var monthLabel = document.getElementById("monthLabel");
  var DOW = ["日", "一", "二", "三", "四", "五", "六"];

  var WD_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  var weekKeyNow = S.getWeekKey(C.now());
  var fixedChecks = document.querySelectorAll("#weekdayEditor input[type=checkbox]");
  var weekdayView = document.getElementById("weekdayView");
  var weekdayEditor = document.getElementById("weekdayEditor");

  function dk(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function hasWorkOnDay(key) {
    var list = S.getSessions();
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s.employee !== emp) continue;
      if (!s.end) {
        if (dk(new Date(s.start)) === key) return true;
        continue;
      }
      var st = new Date(s.start);
      var en = new Date(s.end);
      if (en <= st) continue;
      var cur = new Date(st);
      cur.setHours(0, 0, 0, 0);
      while (cur.getTime() < en.getTime()) {
        if (dk(cur) === key) return true;
        cur.setDate(cur.getDate() + 1);
      }
    }
    return false;
  }

  function renderCalendar() {
    calDow.innerHTML = "";
    DOW.forEach(function (d) {
      var c = document.createElement("div");
      c.className = "cal-dow";
      c.textContent = d;
      calDow.appendChild(c);
    });

    monthLabel.textContent = viewYear + " 年 " + (viewMonth + 1) + " 月";

    var first = new Date(viewYear, viewMonth, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var today = C.now();
    var isThisMonth =
      today.getFullYear() === viewYear && today.getMonth() === viewMonth;

    calDays.innerHTML = "";
    var totalCells = startPad + daysInMonth;
    var rows = Math.ceil(totalCells / 7) * 7;

    for (var i = 0; i < rows; i++) {
      var cell = document.createElement("div");
      cell.className = "cal-cell";

      if (i < startPad || i >= startPad + daysInMonth) {
        cell.classList.add("muted");
        var prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
        var dayNum;
        if (i < startPad) {
          dayNum = prevMonthDays - startPad + i + 1;
        } else {
          dayNum = i - startPad - daysInMonth + 1;
        }
        cell.textContent = dayNum;
      } else {
        var day = i - startPad + 1;
        cell.textContent = String(day);
        var key =
          viewYear +
          "-" +
          String(viewMonth + 1).padStart(2, "0") +
          "-" +
          String(day).padStart(2, "0");
        if (hasWorkOnDay(key)) cell.classList.add("has-work");
        if (isThisMonth && day === today.getDate()) cell.classList.add("today");
      }
      calDays.appendChild(cell);
    }
  }

  document.getElementById("prevMonth").addEventListener("click", function () {
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", function () {
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    renderCalendar();
  });

  function renderAnnualProgress() {
    var now = C.now();
    var y = now.getFullYear();
    var start = new Date(y, 0, 1, 0, 0, 0, 0);
    var end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    var t = now.getTime();
    var pct = ((t - start.getTime()) / (end.getTime() - start.getTime())) * 100;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    var rounded = Math.round(pct * 10) / 10;

    var pctEl = document.getElementById("yearPct");
    var fill = document.getElementById("yearFill");
    var bar = document.getElementById("yearBar");
    var note = document.getElementById("yearNote");
    if (pctEl) pctEl.textContent = rounded + "%";
    if (fill) fill.style.width = rounded + "%";
    if (bar) bar.setAttribute("aria-valuenow", String(Math.round(rounded)));
    if (note) {
      note.textContent =
        y +
        " 年 1 月 1 日 至 12 月 31 日，按已过时间占全年比例计算（本地时区）。";
    }
  }

  function formatDT(iso) {
    var d = new Date(iso);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    var s = String(d.getSeconds()).padStart(2, "0");
    return m + "-" + day + " " + h + ":" + min + ":" + s;
  }

  function fmtH(h) {
    return (Math.round(h * 10) / 10).toFixed(1);
  }

  var weekDetailPanel = document.getElementById("weekDetailPanel");
  var weekDetailList = document.getElementById("weekDetailList");
  var weekDetailHint = document.getElementById("weekDetailHint");
  var btnWeekDetailToggle = document.getElementById("btnWeekDetailToggle");

  function formatRange(startIso, endIso) {
    var startText = formatDT(startIso);
    if (!endIso) return startText + " → 进行中";
    return startText + " → " + formatDT(endIso);
  }

  function getWeekContributionHours(s, weekStart, weekEnd) {
    var st = new Date(s.start).getTime();
    var en = s.end ? new Date(s.end).getTime() : C.nowMs();
    var left = Math.max(st, weekStart.getTime());
    var right = Math.min(en, weekEnd.getTime());
    if (right <= left) return 0;
    return (right - left) / 3600000;
  }

  function renderWeekSessionDetails() {
    if (!weekDetailList || !weekDetailHint) return;
    weekDetailList.innerHTML = "";
    var mon = S.mondayOfWeek(C.now());
    var nextMon = new Date(mon);
    nextMon.setDate(nextMon.getDate() + 7);
    var sessions = S.getSessions().filter(function (s) {
      var st = new Date(s.start).getTime();
      var en = s.end ? new Date(s.end).getTime() : C.nowMs();
      return Math.max(st, mon.getTime()) < Math.min(en, nextMon.getTime());
    });
    sessions.sort(function (a, b) {
      return new Date(a.start) - new Date(b.start);
    });

    weekDetailHint.textContent =
      "统计口径：仅计算与本周一00:00到下周一00:00重叠的时段。";

    if (sessions.length === 0) {
      var empty = document.createElement("li");
      empty.innerHTML =
        "<div class=\"week-detail-main\">本周暂无会话记录</div>" +
        "<div class=\"week-detail-sub\">开始打卡后会显示每段会话的计入时长。</div>";
      weekDetailList.appendChild(empty);
      return;
    }

    ["H", "W"].forEach(function (eid) {
      var title = document.createElement("li");
      title.className = "week-detail-group-title";
      title.textContent = "成员 " + eid;
      weekDetailList.appendChild(title);

      var group = sessions.filter(function (s) {
        return s.employee === eid;
      });
      if (group.length === 0) {
        var none = document.createElement("li");
        none.innerHTML =
          "<div class=\"week-detail-main\">暂无会话</div>" +
          "<div class=\"week-detail-sub\">本周尚未记录该成员会话。</div>";
        weekDetailList.appendChild(none);
        return;
      }
      group.forEach(function (s) {
        var totalH = s.end
          ? W.sessionTotalMin(s.start, s.end) / 60
          : (C.nowMs() - new Date(s.start).getTime()) / 3600000;
        var inWeekH = getWeekContributionHours(s, mon, nextMon);
        var li = document.createElement("li");
        li.innerHTML =
          "<div class=\"week-detail-main\">" +
          formatRange(s.start, s.end) +
          "</div>" +
          "<div class=\"week-detail-sub\">会话时长 " +
          fmtH(totalH) +
          "h；计入本周 " +
          fmtH(inWeekH) +
          "h" +
          (s.note ? "；内容：" + s.note : "") +
          "</div>";
        weekDetailList.appendChild(li);
      });
    });
  }

  if (btnWeekDetailToggle && weekDetailPanel) {
    btnWeekDetailToggle.addEventListener("click", function () {
      var isHidden = weekDetailPanel.hasAttribute("hidden");
      if (isHidden) {
        renderWeekSessionDetails();
        weekDetailPanel.removeAttribute("hidden");
        btnWeekDetailToggle.textContent = "收起本周会话明细";
      } else {
        weekDetailPanel.setAttribute("hidden", "");
        btnWeekDetailToggle.textContent = "查看本周会话明细";
      }
    });
  }

  function renderWeekProgress() {
    var root = document.getElementById("weekProgressContent");
    if (!root) return;
    root.innerHTML = "";
    var mon = S.mondayOfWeek(C.now());
    var thisWkKey = S.getWeekKey(mon);
    var thisWeekFixed = S.getFixedDaysForWeek(thisWkKey);
    var sessions = S.getSessions();

    ["H", "W"].forEach(function (eid) {
      var rep = W.buildReport(eid, mon, sessions, thisWeekFixed);
      var rawPct = Math.max(0, (rep.totalH / W.TARGET_TOTAL_H) * 100);
      var barPct = Math.min(100, rawPct);
      var row = document.createElement("div");
      row.className = "week-progress-row";
      row.innerHTML =
        "<div class=\"week-progress-row-head\">" +
        "<span class=\"week-progress-name\">" +
        eid +
        "</span>" +
        "<span class=\"week-progress-meta\">" +
        fmtH(rep.totalH) +
        "h / 40h（" +
        rawPct.toFixed(1) +
        "%）</span></div>" +
        "<div class=\"week-progress-bar\"><div class=\"week-progress-fill week-progress-fill--" +
        eid.toLowerCase() +
        "\" style=\"width:" +
        barPct.toFixed(1) +
        "%\"></div></div>";
      root.appendChild(row);
    });
  }

  var btnStart = document.getElementById("btnStart");
  var btnEnd = document.getElementById("btnEnd");
  var inTimeDisplay = document.getElementById("inTimeDisplay");
  var outTimeDisplay = document.getElementById("outTimeDisplay");
  var punchToast = document.getElementById("punchToast");
  var isEndingSession = false;

  function refreshPunchUI() {
    var open = S.getOpenSession(emp);
    if (open) {
      btnStart.disabled = true;
      btnEnd.disabled = false;
      inTimeDisplay.textContent = "已开始：" + formatDT(open.start);
      outTimeDisplay.textContent = "进行中…";
    } else {
      btnStart.disabled = false;
      btnEnd.disabled = true;
      inTimeDisplay.textContent = "未在上工状态";
      outTimeDisplay.textContent = "请先上工";
    }
  }

  btnStart.addEventListener("click", function () {
    punchToast.textContent = "";
    S.startSession(emp)
      .then(function (r) {
        if (!r) {
          punchToast.textContent = "已有未结束的会话，请先下工。";
          punchToast.style.color = "#dc2626";
          return;
        }
        punchToast.style.color = "#0d9488";
        punchToast.textContent = "已上工：" + formatDT(r.start);
        refreshPunchUI();
        renderTodayLog();
        renderCalendar();
        renderWeekProgress();
        renderWeekSessionDetails();
      })
      .catch(function (err) {
        punchToast.style.color = "#dc2626";
        punchToast.textContent = (err && err.message) || "上工保存失败";
      });
  });

  var modalEnd = document.getElementById("modalEndNote");
  var endTaskSelect = document.getElementById("endTaskSelect");
  var endNoteTextWrap = document.getElementById("endNoteTextWrap");
  var endNoteText = document.getElementById("endNoteText");
  var modalEdit = document.getElementById("modalEditSession");
  var editStart = document.getElementById("editStart");
  var editEnd = document.getElementById("editEnd");
  var editEndWrap = document.getElementById("editEndWrap");
  var editingSessionId = null;

  function isoToDatetimeLocalValue(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return y + "-" + m + "-" + day + "T" + h + ":" + min;
  }

  function sessionOverlapsLast12h(s) {
    var now = C.nowMs();
    var w0 = now - S.DISPLAY_12H_MS;
    var s0 = new Date(s.start).getTime();
    var e0 = s.end ? new Date(s.end).getTime() : now;
    return Math.max(s0, w0) < Math.min(e0, now);
  }

  function openEndNoteModal() {
    populateEndTaskOptions();
    endTaskSelect.value = "";
    endNoteText.value = "";
    toggleEndOtherInput();
    modalEnd.removeAttribute("hidden");
  }

  function closeEndNoteModal() {
    modalEnd.setAttribute("hidden", "");
  }

  function priorityText(p) {
    if (p === "high") return "高优先";
    if (p === "medium") return "中优先";
    if (p === "routine") return "日常";
    return "低优先";
  }

  function ownerText(o) {
    if (o === "H" || o === "W") return o;
    return "待认领";
  }

  function sortTasksByDdlThenCreate(a, b) {
    var aTs = a.ddlDate ? new Date(a.ddlDate + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
    var bTs = b.ddlDate ? new Date(b.ddlDate + "T00:00:00").getTime() : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    var aC = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    var bC = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bC - aC;
  }

  function populateEndTaskOptions() {
    if (!endTaskSelect) return;
    endTaskSelect.innerHTML =
      "<option value=\"\">请选择任务…</option><option value=\"__other__\">其他（手动填写）</option>";
    S.getTasks()
      .filter(function (t) {
        return !t.done && t.owner === emp;
      })
      .sort(sortTasksByDdlThenCreate)
      .forEach(function (t) {
        var op = document.createElement("option");
        op.value = t.id;
        op.textContent =
          "[" +
          priorityText(t.priority) +
          "] " +
          t.text +
          (t.ddlDate ? "（DDL " + t.ddlDate + "）" : "");
        endTaskSelect.appendChild(op);
      });
  }

  function toggleEndOtherInput() {
    if (!endTaskSelect || !endNoteTextWrap) return;
    var isOther = endTaskSelect.value === "__other__";
    endNoteTextWrap.style.display = isOther ? "" : "none";
  }

  function openEditModal(s) {
    editingSessionId = s.id;
    editStart.value = isoToDatetimeLocalValue(s.start);
    if (s.end) {
      editEndWrap.style.display = "";
      editEnd.value = isoToDatetimeLocalValue(s.end);
    } else {
      editEndWrap.style.display = "none";
      editEnd.value = "";
    }
    modalEdit.removeAttribute("hidden");
  }

  function closeEditModal() {
    editingSessionId = null;
    modalEdit.setAttribute("hidden", "");
  }

  btnEnd.addEventListener("click", function () {
    punchToast.textContent = "";
    if (!S.getOpenSession(emp)) {
      punchToast.textContent = "当前没有进行中的上工记录。";
      punchToast.style.color = "#dc2626";
      return;
    }
    openEndNoteModal();
  });

  function reliableEndSession(note) {
    return S.endSession(emp, note).then(function (result) {
      if (result) return result;
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(S.endSession(emp, note));
        }, 350);
      });
    });
  }

  document.getElementById("endNoteConfirm").addEventListener("click", function () {
    if (isEndingSession) return;
    isEndingSession = true;
    var confirmBtn = document.getElementById("endNoteConfirm");
    confirmBtn.disabled = true;
    var note = "";
    if (endTaskSelect && endTaskSelect.value && endTaskSelect.value !== "__other__") {
      var allTasks = S.getTasks();
      var chosen = allTasks.filter(function (t) {
        return t.id === endTaskSelect.value;
      })[0];
      note = chosen ? "任务：" + chosen.text : "";
    } else if (endTaskSelect && endTaskSelect.value === "__other__") {
      note = String(endNoteText.value || "").trim();
      if (!note) {
        punchToast.textContent = "选择“其他”时请填写说明。";
        punchToast.style.color = "#dc2626";
        isEndingSession = false;
        confirmBtn.disabled = false;
        return;
      }
      note = "其他：" + note;
    } else {
      punchToast.textContent = "请先选择任务或“其他”。";
      punchToast.style.color = "#dc2626";
      isEndingSession = false;
      confirmBtn.disabled = false;
      return;
    }
    reliableEndSession(note)
      .then(function (r) {
        if (!r) {
          punchToast.textContent = "当前没有进行中的上工记录。";
          punchToast.style.color = "#dc2626";
          return;
        }
        closeEndNoteModal();
        punchToast.style.color = "#0d9488";
        var mins = W.sessionTotalMin(r.start, r.end);
        punchToast.textContent =
          "已下工，本段时长 " + fmtH(mins / 60) + " 小时";
        refreshPunchUI();
        renderTodayLog();
        renderCalendar();
        renderWeekProgress();
        renderWeekSessionDetails();
      })
      .catch(function (err) {
        punchToast.style.color = "#dc2626";
        punchToast.textContent = (err && err.message) || "下工保存失败";
      })
      .finally(function () {
        isEndingSession = false;
        confirmBtn.disabled = false;
      });
  });

  document.getElementById("endNoteCancel").addEventListener("click", closeEndNoteModal);
  if (endTaskSelect) {
    endTaskSelect.addEventListener("change", toggleEndOtherInput);
  }
  document.getElementById("modalEndNoteBackdrop").addEventListener("click", closeEndNoteModal);

  document.getElementById("editSessionCancel").addEventListener("click", closeEditModal);
  document.getElementById("modalEditBackdrop").addEventListener("click", closeEditModal);

  document.getElementById("editSessionSave").addEventListener("click", function () {
    if (!editingSessionId) return;
    var s = S.getSessions().filter(function (x) {
      return x.id === editingSessionId;
    })[0];
    if (!s) {
      closeEditModal();
      return;
    }
    var startVal = editStart.value;
    if (!startVal) {
      punchToast.textContent = "请填写上工时间";
      punchToast.style.color = "#dc2626";
      return;
    }
    var startIso = new Date(startVal).toISOString();
    var p;
    if (s.end) {
      var endVal = editEnd.value;
      if (!endVal) {
        punchToast.textContent = "请填写下工时间";
        punchToast.style.color = "#dc2626";
        return;
      }
      var endIso = new Date(endVal).toISOString();
      p = S.updateSessionTimes(editingSessionId, startIso, endIso);
    } else {
      p = S.updateOpenSessionStart(editingSessionId, startIso);
    }
    p.then(function () {
      closeEditModal();
      punchToast.style.color = "#0d9488";
      punchToast.textContent = "时间已更新";
      refreshPunchUI();
      renderTodayLog();
      renderCalendar();
      renderWeekProgress();
      renderWeekSessionDetails();
    }).catch(function (err) {
      punchToast.style.color = "#dc2626";
      punchToast.textContent = (err && err.message) || "保存失败";
    });
  });

  function renderTodayLog() {
    var list = document.getElementById("todayLog");
    list.innerHTML = "";

    var items = S.getSessions()
      .filter(function (s) {
        return s.employee === emp;
      })
      .filter(sessionOverlapsLast12h);
    items.sort(function (a, b) {
      return new Date(a.start) - new Date(b.start);
    });

    if (items.length === 0) {
      var empty = document.createElement("li");
      empty.textContent = "最近 12 小时内暂无会话";
      empty.style.cssText = "display:block;border:none;background:transparent;";
      list.appendChild(empty);
      return;
    }

    items.forEach(function (s) {
      var li = document.createElement("li");
      li.className = "log-row " + (s.employee === "H" ? "log-row--h" : "log-row--w");

      var top = document.createElement("div");
      top.className = "log-row-top";

      var tag = document.createElement("span");
      tag.className = "log-emp-tag " + (s.employee === "H" ? "h" : "w");
      tag.textContent = s.employee === "H" ? "H" : "W";

      var meta = document.createElement("div");
      meta.style.textAlign = "right";
      meta.style.flex = "1";
      if (!s.end) {
        meta.textContent = "进行中 · 上工 " + formatDT(s.start);
      } else {
        var mins = W.sessionTotalMin(s.start, s.end);
        meta.textContent =
          fmtH(mins / 60) +
          "h · " +
          formatDT(s.start) +
          " → " +
          formatDT(s.end);
      }

      top.appendChild(tag);
      top.appendChild(meta);
      li.appendChild(top);

      if (s.note) {
        var noteEl = document.createElement("div");
        noteEl.className = "session-note-line";
        noteEl.textContent = "记录：" + s.note;
        li.appendChild(noteEl);
      }

      var btnRow = document.createElement("div");
      btnRow.style.display = "flex";
      btnRow.style.justifyContent = "flex-end";
      btnRow.style.marginTop = "0.25rem";
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost btn-tiny";
      editBtn.textContent = "修改时间";
      editBtn.addEventListener("click", function () {
        openEditModal(s);
      });
      btnRow.appendChild(editBtn);
      li.appendChild(btnRow);

      list.appendChild(li);
    });
  }

  function refreshAllPanels() {
    S.ensureSessionLimits().then(function () {
      refreshPunchUI();
      renderTodayLog();
      renderCalendar();
      renderWeekProgress();
      renderWeekSessionDetails();
      renderClockTester();
    });
  }

  function bindCloudRefreshButtons() {
    function wire(btnId, options, onDone) {
      var btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("click", function () {
        if (!S.isCloud()) return;
        if (btn.disabled) return;
        btn.disabled = true;
        var old = btn.textContent;
        btn.textContent = "…";
        S.refreshCloudData(options)
          .then(function () {
            if (typeof onDone === "function") onDone();
          })
          .catch(function (e) {
            punchToast.style.color = "#dc2626";
            punchToast.textContent = (e && e.message) || "云端刷新失败";
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = old;
          });
      });
    }
    wire("btnRefreshWorkbench", { sessions: true, tasks: true, week: true }, refreshAllPanels);
    wire("btnRefreshStudioTasks", { sessions: false, tasks: true, week: false }, function () {
      renderStudioTasks();
      renderTaskHistory();
      populateEndTaskOptions();
    });
    wire("btnRefreshDailyTasks", { sessions: false, tasks: true, week: false }, function () {
      renderDailyTasks();
      populateEndTaskOptions();
    });
  }

  setInterval(function () {
    refreshAllPanels();
  }, 60000);
  window.addEventListener("studio:data-updated", function () {
    refreshAllPanels();
  });

  function formatOffset(ms) {
    if (!ms) return "0";
    var sign = ms > 0 ? "+" : "-";
    var abs = Math.abs(ms);
    var h = Math.floor(abs / 3600000);
    var m = Math.floor((abs % 3600000) / 60000);
    return sign + h + "h " + m + "m";
  }

  function renderClockTester() {
    var nowText = document.getElementById("clockNowText");
    if (!nowText) return;
    nowText.textContent =
      "模拟时间：" + formatDT(C.now().toISOString()) + "（偏移 " + formatOffset(C.getOffsetMs()) + "）";
  }

  function bindClockTester() {
    var toggleBtn = document.getElementById("btnClockToolsToggle");
    var panel = document.getElementById("clockTestPanel");
    var b10m = document.getElementById("btnClockPlus10m");
    var b1h = document.getElementById("btnClockPlus1h");
    var b1d = document.getElementById("btnClockPlus1d");
    var bReset = document.getElementById("btnClockReset");
    if (!b10m || !b1h || !b1d || !bReset || !toggleBtn || !panel) return;
    toggleBtn.addEventListener("click", function () {
      var hidden = panel.hasAttribute("hidden");
      if (hidden) {
        panel.removeAttribute("hidden");
        toggleBtn.textContent = "收起测试工具";
      } else {
        panel.setAttribute("hidden", "");
        toggleBtn.textContent = "展开测试工具";
      }
    });
    b10m.addEventListener("click", function () {
      C.advanceMs(10 * 60 * 1000);
      S.markAllOpenSessionsTimeShifted();
      refreshAllPanels();
    });
    b1h.addEventListener("click", function () {
      C.advanceMs(60 * 60 * 1000);
      S.markAllOpenSessionsTimeShifted();
      refreshAllPanels();
    });
    b1d.addEventListener("click", function () {
      C.advanceMs(24 * 60 * 60 * 1000);
      S.markAllOpenSessionsTimeShifted();
      refreshAllPanels();
    });
    bReset.addEventListener("click", function () {
      C.reset();
      S.markAllOpenSessionsTimeShifted();
      refreshAllPanels();
    });
  }

  function readChecksToArr() {
    var arr = [];
    for (var i = 0; i < 7; i++) arr.push(false);
    fixedChecks.forEach(function (cb) {
      var j = parseInt(cb.getAttribute("data-wd"), 10);
      arr[j] = cb.checked;
    });
    return arr;
  }

  function applyArrToChecks(arr) {
    fixedChecks.forEach(function (cb) {
      var j = parseInt(cb.getAttribute("data-wd"), 10);
      cb.checked = !!arr[j];
    });
  }

  function formatSummary(arr) {
    var names = [];
    for (var i = 0; i < 7; i++) {
      if (arr[i]) names.push(WD_LABELS[i]);
    }
    if (names.length === 0) return "未设置（默认周一至周五）";
    return names.join("、") + "（共 " + names.length + " 天）";
  }

  function updateWeekSummary() {
    var arr = S.getFixedDaysForWeek(weekKeyNow);
    var el = document.getElementById("weekdaySummary");
    if (el) el.textContent = formatSummary(arr);
  }

  function enterWeekEdit() {
    var saved = S.getFixedDaysForWeek(weekKeyNow);
    applyArrToChecks(saved);
    document.getElementById("weekdayHint").textContent = "";
    weekdayView.hidden = true;
    weekdayEditor.hidden = false;
  }

  function exitWeekEdit() {
    weekdayEditor.hidden = true;
    weekdayView.hidden = false;
    document.getElementById("weekdayHint").textContent = "";
  }

  document.getElementById("btnWeekEdit").addEventListener("click", enterWeekEdit);

  document.getElementById("btnWeekCancel").addEventListener("click", function () {
    exitWeekEdit();
  });

  document.getElementById("btnWeekConfirm").addEventListener("click", function () {
    var arr = readChecksToArr();
    var n = 0;
    for (var i = 0; i < 7; i++) if (arr[i]) n++;
    var hint = document.getElementById("weekdayHint");
    if (n !== 5) {
      hint.textContent = "需要选择五天方可确认修改。";
      hint.style.color = "#dc2626";
      return;
    }
    S.setFixedDaysForWeek(weekKeyNow, arr).then(function (ok) {
      if (!ok) {
        hint.textContent = "保存失败，请重试。";
        hint.style.color = "#dc2626";
        return;
      }
      hint.style.color = "";
      updateWeekSummary();
      exitWeekEdit();
    });
  });

  updateWeekSummary();

  var currentTaskPriorityFilter = "all";

  function taskPriorityRank(p) {
    if (p === "high") return 1;
    if (p === "medium") return 2;
    if (p === "routine") return 3;
    return 4;
  }

  function repeatText(days) {
    if (!Array.isArray(days)) return "";
    var names = ["一", "二", "三", "四", "五", "六", "日"];
    var hit = [];
    for (var i = 0; i < 7; i++) if (days[i]) hit.push("周" + names[i]);
    if (hit.length === 0) return "不重复";
    if (hit.length === 7) return "每天";
    return hit.join("、");
  }

  function readRepeatDays(selector) {
    var arr = [false, false, false, false, false, false, false];
    Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (cb) {
      var idx = parseInt(cb.getAttribute("data-repeat-day") || cb.getAttribute("data-daily-repeat-day"), 10);
      if (!isNaN(idx) && idx >= 0 && idx < 7) arr[idx] = !!cb.checked;
    });
    return arr;
  }

  function setAllRepeatDays(selector, checked) {
    Array.prototype.slice.call(document.querySelectorAll(selector)).forEach(function (cb) {
      cb.checked = checked;
    });
  }

  function renderTaskHistory() {
    var historyList = document.getElementById("taskHistoryList");
    if (!historyList) return;
    historyList.innerHTML = "";
    var all = S.getTasks().slice();
    all.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done && b.done) {
        var ad = a.doneAt ? new Date(a.doneAt).getTime() : 0;
        var bd = b.doneAt ? new Date(b.doneAt).getTime() : 0;
        return bd - ad;
      }
      var dd = sortTasksByDdlThenCreate(a, b);
      if (dd !== 0) return dd;
      return taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
    });
    ["进行中", "已完成"].forEach(function (groupName, idx) {
      var doneFlag = idx === 1;
      var gtitle = document.createElement("li");
      gtitle.className = "week-detail-group-title";
      gtitle.textContent = groupName;
      historyList.appendChild(gtitle);
      var groupItems = all.filter(function (t) {
        return !!t.done === doneFlag;
      });
      if (groupItems.length === 0) {
        var empty = document.createElement("li");
        empty.innerHTML =
          "<div class=\"week-detail-main\">暂无任务</div>" +
          "<div class=\"week-detail-sub\">当前分组没有可显示的任务。</div>";
        historyList.appendChild(empty);
        return;
      }
      groupItems.forEach(function (t) {
        var li = document.createElement("li");
        li.innerHTML =
          "<div class=\"week-detail-main\">[" +
          priorityText(t.priority) +
          "] " +
          t.text +
          "</div>" +
          "<div class=\"week-detail-sub\">范围：" +
          (t.scope === "personal" ? "每日任务" : "工作室任务") +
          "；负责人：" +
          ownerText(t.owner) +
          "；" +
          (t.ddlDate ? "DDL：" + t.ddlDate + "；" : "") +
          (t.priority === "routine" ? "重复：" + repeatText(t.repeatDays) + "；" : "") +
          (t.done ? "完成于：" + (t.doneAt ? formatDT(t.doneAt) : "已完成") : "状态：进行中") +
          "</div>";
        historyList.appendChild(li);
      });
    });
  }

  function renderStudioTasks() {
    var ul = document.getElementById("taskList");
    ul.innerHTML = "";
    var tasks = S.getTasks()
      .filter(function (t) {
        return t.scope !== "personal" && !t.done;
      })
      .filter(function (t) {
        return currentTaskPriorityFilter === "all" || t.priority === currentTaskPriorityFilter;
      })
      .sort(function (a, b) {
        var byDdl = sortTasksByDdlThenCreate(a, b);
        if (byDdl !== 0) return byDdl;
        return taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
      });
    if (tasks.length === 0) {
      var empty = document.createElement("li");
      empty.textContent = "当前筛选条件下暂无进行中任务";
      ul.appendChild(empty);
      renderTaskHistory();
      return;
    }
    tasks.forEach(function (t) {
      var li = document.createElement("li");
      li.classList.add("task-priority-" + (t.priority || "low"));
      if (t.owner === "U") li.classList.add("task-owner-unclaimed");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = false;
      cb.setAttribute("aria-label", "完成");
      cb.addEventListener("change", function () {
        S.toggleTask(t.id).then(function () {
          renderTasks();
          populateEndTaskOptions();
        });
      });
      var span = document.createElement("span");
      span.style.flex = "1";
      span.textContent =
        "[" +
        priorityText(t.priority) +
        "] " +
        t.text +
        " · 负责人：" +
        ownerText(t.owner) +
        (t.owner === "U" ? "（待认领）" : "") +
        (t.ddlDate ? " · DDL：" + t.ddlDate : "") +
        (t.priority === "routine" ? " · 重复：" + repeatText(t.repeatDays) : "");
      var ownerSel = document.createElement("select");
      ownerSel.className = "task-owner-inline";
      ownerSel.innerHTML =
        "<option value=\"H\">H</option>" +
        "<option value=\"W\">W</option>" +
        "<option value=\"U\">待认领</option>";
      ownerSel.value = t.owner || "U";
      ownerSel.addEventListener("change", function () {
        S.updateTaskOwner(t.id, ownerSel.value).then(function () {
          renderTasks();
          populateEndTaskOptions();
        });
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-ghost";
      del.style.padding = "0.2rem 0.45rem";
      del.style.fontSize = "0.78rem";
      del.textContent = "删除";
      del.addEventListener("click", function () {
        S.deleteTask(t.id).then(function () {
          renderTasks();
          populateEndTaskOptions();
        });
      });
      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(ownerSel);
      li.appendChild(del);
      ul.appendChild(li);
    });
    renderTaskHistory();
  }

  function renderDailyTasks() {
    var ul = document.getElementById("dailyTaskList");
    if (!ul) return;
    ul.innerHTML = "";
    var tasks = S.getTasks()
      .filter(function (t) {
        return t.owner === emp;
      })
      .sort(function (a, b) {
        if (!!a.done !== !!b.done) return a.done ? 1 : -1;
        var byDdl = sortTasksByDdlThenCreate(a, b);
        if (byDdl !== 0) return byDdl;
        return taskPriorityRank(a.priority) - taskPriorityRank(b.priority);
      });
    if (tasks.length === 0) {
      var empty = document.createElement("li");
      empty.textContent = "当前成员暂无任务";
      ul.appendChild(empty);
      return;
    }
    tasks.forEach(function (t) {
      var li = document.createElement("li");
      li.classList.add("task-priority-" + (t.priority || "low"));
      var isQuick = S.isQuickTask(t.id);
      if (isQuick) li.classList.add("task-quick-entry");
      if (t.done) li.classList.add("done");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!t.done;
      cb.setAttribute("aria-label", "完成");
      cb.addEventListener("change", function () {
        S.toggleTask(t.id).then(function () {
          renderTasks();
          populateEndTaskOptions();
        });
      });
      var span = document.createElement("span");
      span.style.flex = "1";
      var priLabel = isQuick && t.priority === "low" ? "" : "[" + priorityText(t.priority) + "] ";
      span.textContent =
        priLabel +
        t.text +
        (t.ddlDate ? " · DDL：" + t.ddlDate : "") +
        (t.priority === "routine" ? " · 重复：" + repeatText(t.repeatDays) : "") +
        (t.scope === "personal" ? " · 个人" : " · 工作室");
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-ghost";
      del.style.padding = "0.2rem 0.45rem";
      del.style.fontSize = "0.78rem";
      del.textContent = "删除";
      del.addEventListener("click", function () {
        S.deleteTask(t.id).then(function () {
          renderTasks();
          populateEndTaskOptions();
        });
      });
      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function renderTasks() {
    renderStudioTasks();
    renderDailyTasks();
  }

  document.getElementById("taskPriority").addEventListener("change", function (e) {
    var ddlInput = document.getElementById("taskDdlDate");
    var repeatPicker = document.getElementById("taskRepeatPicker");
    var p = e.target.value;
    ddlInput.disabled = p === "low" || p === "routine";
    if (ddlInput.disabled) ddlInput.value = "";
    repeatPicker.hidden = p !== "routine";
  });

  document.getElementById("dailyTaskPriority").addEventListener("change", function (e) {
    var ddlInput = document.getElementById("dailyTaskDdlDate");
    var repeatPicker = document.getElementById("dailyRepeatPicker");
    var p = e.target.value;
    ddlInput.disabled = p === "low" || p === "routine";
    if (ddlInput.disabled) ddlInput.value = "";
    repeatPicker.hidden = p !== "routine";
  });

  document.getElementById("btnTaskRepeatAll").addEventListener("click", function () {
    setAllRepeatDays("#taskRepeatPicker input[type=checkbox]", true);
  });
  document.getElementById("btnDailyRepeatAll").addEventListener("click", function () {
    setAllRepeatDays("#dailyRepeatPicker input[type=checkbox]", true);
  });

  document.getElementById("taskFilters").addEventListener("click", function (e) {
    var btn = e.target.closest(".task-filter");
    if (!btn) return;
    currentTaskPriorityFilter = btn.getAttribute("data-p") || "all";
    Array.prototype.slice.call(document.querySelectorAll(".task-filter")).forEach(function (x) {
      x.classList.remove("active");
    });
    btn.classList.add("active");
    renderStudioTasks();
  });

  document.getElementById("btnTaskHistoryToggle").addEventListener("click", function () {
    var panel = document.getElementById("taskHistoryPanel");
    var hidden = panel.hasAttribute("hidden");
    if (hidden) {
      panel.removeAttribute("hidden");
      this.textContent = "收起任务历史";
      renderTaskHistory();
    } else {
      panel.setAttribute("hidden", "");
      this.textContent = "查看任务历史";
    }
  });

  document.getElementById("taskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("taskInput");
    var owner = document.getElementById("taskOwner").value;
    var priority = document.getElementById("taskPriority").value;
    var ddlDate = document.getElementById("taskDdlDate").value;
    var hint = document.getElementById("taskFormHint");
    var repeatDays = readRepeatDays("#taskRepeatPicker input[type=checkbox]");
    hint.textContent = "";
    if ((priority === "high" || priority === "medium") && !ddlDate) {
      hint.textContent = "高/中优先任务必须选择 DDL 日期。";
      hint.style.color = "#dc2626";
      return;
    }
    if (priority === "routine" && repeatDays.filter(Boolean).length === 0) {
      hint.textContent = "日常任务至少选择一个重复日期。";
      hint.style.color = "#dc2626";
      return;
    }
    S.addTask(owner, input.value, priority, ddlDate, { scope: "studio", repeatDays: repeatDays })
      .then(function (item) {
        if (item) {
          input.value = "";
          document.getElementById("taskDdlDate").value = "";
          hint.textContent = "";
          setAllRepeatDays("#taskRepeatPicker input[type=checkbox]", false);
          renderTasks();
          populateEndTaskOptions();
        } else {
          hint.textContent = "添加失败：请检查任务内容是否为空。";
          hint.style.color = "#dc2626";
        }
      })
      .catch(function (err) {
        var msg = (err && err.message) || "";
        if (msg && /column|schema|owner|priority|ddl_date|created_at|done_at|scope|repeat_days/i.test(msg)) {
          hint.textContent = "添加失败：请先执行 Supabase 迁移（supabase/migration_task_fields.sql）。";
        } else {
          hint.textContent = "添加失败：" + (msg || "未知错误，请重试。");
        }
        hint.style.color = "#dc2626";
      });
  });

  document.getElementById("btnDailyAddToggle").addEventListener("click", function () {
    var form = document.getElementById("dailyTaskForm");
    var quickForm = document.getElementById("dailyQuickForm");
    var hidden = form.hasAttribute("hidden");
    if (hidden) {
      quickForm.setAttribute("hidden", "");
      form.removeAttribute("hidden");
      this.textContent = "收起";
    } else {
      form.setAttribute("hidden", "");
      this.textContent = "添加任务";
    }
  });

  document.getElementById("dailyTaskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("dailyTaskInput");
    var priority = document.getElementById("dailyTaskPriority").value;
    var ddlDate = document.getElementById("dailyTaskDdlDate").value;
    var hint = document.getElementById("dailyTaskHint");
    var repeatDays = readRepeatDays("#dailyRepeatPicker input[type=checkbox]");
    hint.textContent = "";
    if ((priority === "high" || priority === "medium") && !ddlDate) {
      hint.textContent = "高/中优先任务必须选择 DDL 日期。";
      hint.style.color = "#dc2626";
      return;
    }
    if (priority === "routine" && repeatDays.filter(Boolean).length === 0) {
      hint.textContent = "日常任务至少选择一个重复日期。";
      hint.style.color = "#dc2626";
      return;
    }
    S.addTask(emp, input.value, priority, ddlDate, { scope: "personal", repeatDays: repeatDays })
      .then(function (item) {
        if (item) {
          input.value = "";
          document.getElementById("dailyTaskDdlDate").value = "";
          hint.textContent = "";
          setAllRepeatDays("#dailyRepeatPicker input[type=checkbox]", false);
          renderTasks();
          populateEndTaskOptions();
        } else {
          hint.textContent = "添加失败：请检查任务内容是否为空。";
          hint.style.color = "#dc2626";
        }
      })
      .catch(function (err) {
        hint.textContent = "添加失败：" + ((err && err.message) || "未知错误");
        hint.style.color = "#dc2626";
      });
  });

  document.getElementById("btnDailyQuickAdd").addEventListener("click", function () {
    var form = document.getElementById("dailyQuickForm");
    var mainForm = document.getElementById("dailyTaskForm");
    var mainBtn = document.getElementById("btnDailyAddToggle");
    var hidden = form.hasAttribute("hidden");
    if (hidden) {
      mainForm.setAttribute("hidden", "");
      mainBtn.textContent = "添加任务";
      form.removeAttribute("hidden");
    } else form.setAttribute("hidden", "");
  });

  document.getElementById("dailyQuickForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("dailyQuickInput");
    var text = String(input.value || "").trim();
    if (!text) return;
    S.addTask(emp, text, "low", null, {
      scope: "personal",
      repeatDays: [false, false, false, false, false, false, false]
    }).then(function (item) {
      if (item && item.id) S.markTaskAsQuick(item.id);
      input.value = "";
      document.getElementById("dailyQuickForm").setAttribute("hidden", "");
      renderTasks();
      populateEndTaskOptions();
    });
  });

  renderCalendar();
  renderAnnualProgress();
  renderWeekProgress();
  refreshPunchUI();
  renderTodayLog();
  bindClockTester();
  bindCloudRefreshButtons();
  renderClockTester();
  document.getElementById("taskPriority").dispatchEvent(new Event("change"));
  document.getElementById("dailyTaskPriority").dispatchEvent(new Event("change"));
  renderTasks();
  }
})();
