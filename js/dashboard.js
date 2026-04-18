(function () {
  var S = window.StudioStore;
  var W = window.Worktime;
  if (!S || !W) return;

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

  document.getElementById("btnLogout").addEventListener("click", function () {
    S.clearAuth();
    window.location.href = "index.html";
  });

  var viewYear = new Date().getFullYear();
  var viewMonth = new Date().getMonth();
  var calDow = document.getElementById("calDow");
  var calDays = document.getElementById("calDays");
  var monthLabel = document.getElementById("monthLabel");
  var DOW = ["日", "一", "二", "三", "四", "五", "六"];

  var WD_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  var weekKeyNow = S.getWeekKey(new Date());
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
    var today = new Date();
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
    var now = new Date();
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
    var en = s.end ? new Date(s.end).getTime() : Date.now();
    var left = Math.max(st, weekStart.getTime());
    var right = Math.min(en, weekEnd.getTime());
    if (right <= left) return 0;
    return (right - left) / 3600000;
  }

  function renderWeekSessionDetails() {
    if (!weekDetailList || !weekDetailHint) return;
    weekDetailList.innerHTML = "";
    var mon = S.mondayOfWeek(new Date());
    var nextMon = new Date(mon);
    nextMon.setDate(nextMon.getDate() + 7);
    var sessions = S.getSessions().filter(function (s) {
      var st = new Date(s.start).getTime();
      var en = s.end ? new Date(s.end).getTime() : Date.now();
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

    sessions.forEach(function (s) {
      var totalH = s.end ? W.sessionTotalMin(s.start, s.end) / 60 : (Date.now() - new Date(s.start).getTime()) / 3600000;
      var inWeekH = getWeekContributionHours(s, mon, nextMon);
      var li = document.createElement("li");
      li.innerHTML =
        "<div class=\"week-detail-main\">" +
        s.employee +
        " · " +
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
    var mon = S.mondayOfWeek(new Date());
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
    var now = Date.now();
    var w0 = now - S.DISPLAY_12H_MS;
    var s0 = new Date(s.start).getTime();
    var e0 = s.end ? new Date(s.end).getTime() : now;
    return Math.max(s0, w0) < Math.min(e0, now);
  }

  function openEndNoteModal() {
    endNoteText.value = "";
    modalEnd.removeAttribute("hidden");
  }

  function closeEndNoteModal() {
    modalEnd.setAttribute("hidden", "");
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

  document.getElementById("endNoteConfirm").addEventListener("click", function () {
    var note = endNoteText.value;
    S.endSession(emp, note)
      .then(function (r) {
        closeEndNoteModal();
        if (!r) {
          punchToast.textContent = "当前没有进行中的上工记录。";
          punchToast.style.color = "#dc2626";
          return;
        }
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
      });
  });

  document.getElementById("endNoteCancel").addEventListener("click", closeEndNoteModal);
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

    var items = S.getSessions().filter(sessionOverlapsLast12h);
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

  setInterval(function () {
    S.ensureSessionLimits().then(function () {
      refreshPunchUI();
      renderTodayLog();
      renderCalendar();
      renderWeekProgress();
      renderWeekSessionDetails();
    });
  }, 60000);

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

  function renderTasks() {
    var ul = document.getElementById("taskList");
    ul.innerHTML = "";
    S.getTasks()
      .filter(function (t) {
        return t.employee === emp;
      })
      .forEach(function (t) {
        var li = document.createElement("li");
        if (t.done) li.classList.add("done");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = t.done;
        cb.setAttribute("aria-label", "完成");
        cb.addEventListener("change", function () {
          S.toggleTask(t.id).then(function () {
            renderTasks();
          });
        });
        var span = document.createElement("span");
        span.style.flex = "1";
        span.textContent = t.text;
        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-ghost";
        del.style.padding = "0.2rem 0.45rem";
        del.style.fontSize = "0.78rem";
        del.textContent = "删除";
        del.addEventListener("click", function () {
          S.deleteTask(t.id).then(function () {
            renderTasks();
          });
        });
        li.appendChild(cb);
        li.appendChild(span);
        li.appendChild(del);
        ul.appendChild(li);
      });
  }

  document.getElementById("taskForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("taskInput");
    S.addTask(emp, input.value).then(function (item) {
      if (item) {
        input.value = "";
        renderTasks();
      }
    });
  });

  renderCalendar();
  renderAnnualProgress();
  renderWeekProgress();
  refreshPunchUI();
  renderTodayLog();
  renderTasks();
  }
})();
