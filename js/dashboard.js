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
      })
      .catch(function (err) {
        punchToast.style.color = "#dc2626";
        punchToast.textContent = (err && err.message) || "上工保存失败";
      });
  });

  btnEnd.addEventListener("click", function () {
    punchToast.textContent = "";
    S.endSession(emp)
      .then(function (r) {
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
      })
      .catch(function (err) {
        punchToast.style.color = "#dc2626";
        punchToast.textContent = (err && err.message) || "下工保存失败";
      });
  });

  function todayKey() {
    return dk(new Date());
  }

  function renderTodayLog() {
    var list = document.getElementById("todayLog");
    var tk = todayKey();
    list.innerHTML = "";

    var items = [];
    S.getSessions().forEach(function (s) {
      if (s.employee !== emp) return;
      if (!s.end) {
        if (dk(new Date(s.start)) === tk) {
          items.push({ type: "open", s: s });
        }
        return;
      }
      var st = new Date(s.start);
      var en = new Date(s.end);
      var k1 = dk(st);
      var k2 = dk(en);
      if (k1 === tk || k2 === tk) {
        items.push({ type: "done", s: s });
      }
    });

    items.sort(function (a, b) {
      return new Date(b.s.start) - new Date(a.s.start);
    });

    if (items.length === 0) {
      var li = document.createElement("li");
      li.textContent = "今日暂无会话";
      list.appendChild(li);
      return;
    }

    items.forEach(function (it) {
      var s = it.s;
      var li = document.createElement("li");
      if (it.type === "open") {
        li.innerHTML =
          '<span>进行中</span><span class="log-time">上工 ' +
          formatDT(s.start) +
          "</span>";
      } else {
        var m = W.sessionTotalMin(s.start, s.end);
        li.innerHTML =
          '<span>' +
          fmtH(m / 60) +
          "h</span><span class=\"log-time\">" +
          formatDT(s.start) +
          " → " +
          formatDT(s.end) +
          "</span>";
      }
      list.appendChild(li);
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
  refreshPunchUI();
  renderTodayLog();
  renderTasks();
  }
})();
