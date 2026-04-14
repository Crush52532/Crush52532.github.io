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
      bootReport();
    })
    .catch(function (e) {
      console.error(e);
      bootReport();
    });

  function bootReport() {
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

  function dk(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function fmtH(h) {
    return (Math.round(h * 10) / 10).toFixed(1);
  }

  function renderReport() {
    var now = new Date();
    var mon = S.mondayOfWeek(now);
    var lastMon = new Date(mon);
    lastMon.setDate(lastMon.getDate() - 7);

    var endSun = new Date(lastMon);
    endSun.setDate(endSun.getDate() + 6);
    document.getElementById("reportRange").textContent =
      "统计区间：" +
      dk(lastMon) +
      "（周一）至 " +
      dk(endSun) +
      "（周日）";

    var wkKey = S.getWeekKey(lastMon);
    var fixed = S.getFixedDaysForWeek(wkKey);
    var thisWkKey = S.getWeekKey(mon);
    var thisWeekFixed = S.getFixedDaysForWeek(thisWkKey);

    var reportContent = document.getElementById("reportContent");
    reportContent.innerHTML = "";
    var weekProgressContent = document.getElementById("weekProgressContent");
    if (weekProgressContent) weekProgressContent.innerHTML = "";

    ["H", "W"].forEach(function (eid) {
      var thisWeekRep = W.buildReport(eid, mon, S.getSessions(), thisWeekFixed);
      var rawPct = Math.max(0, (thisWeekRep.totalH / W.TARGET_TOTAL_H) * 100);
      var barPct = Math.min(100, rawPct);
      if (weekProgressContent) {
        var row = document.createElement("div");
        row.className = "week-progress-row";
        row.innerHTML =
          "<div class=\"week-progress-row-head\">" +
          "<span class=\"week-progress-name\">" +
          eid +
          "</span>" +
          "<span class=\"week-progress-meta\">" +
          fmtH(thisWeekRep.totalH) +
          "h / 40h（" +
          rawPct.toFixed(1) +
          "%）</span></div>" +
          "<div class=\"week-progress-bar\"><div class=\"week-progress-fill week-progress-fill--" +
          eid.toLowerCase() +
          "\" style=\"width:" +
          barPct.toFixed(1) +
          "%\"></div></div>";
        weekProgressContent.appendChild(row);
      }
    });

    ["H", "W"].forEach(function (eid) {
      var rep = W.buildReport(eid, lastMon, S.getSessions(), fixed);

      var labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      var dayRows = [];
      for (var d = 0; d < 7; d++) {
        var dt = new Date(lastMon);
        dt.setDate(dt.getDate() + d);
        var key = dk(dt);
        var found = rep.days.filter(function (x) {
          return x.key === key;
        })[0];
        var total = found ? found.totalH : 0;
        var fx = found ? found.fixedSlotH : 0;
        var fl = found ? found.flexH : 0;
        var fd = found ? found.isFixedDay : fixed[d];
        dayRows.push({
          label: labels[d],
          key: key,
          total: total,
          fixed: fx,
          flex: fl,
          isFD: fd
        });
      }

      var box = document.createElement("div");
      box.className = "report-emp";
      var title = document.createElement("h4");
      title.textContent = "成员 " + eid;
      box.appendChild(title);

      var tbl = document.createElement("table");
      tbl.className = "report-table";
      tbl.innerHTML =
        "<thead><tr><th>日期</th><th>星期</th><th>固定日</th><th>总工时(h)</th><th>固定窗口内(h)</th><th>弹性(h)</th></tr></thead>";
      var tb = document.createElement("tbody");
      dayRows.forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          row.key +
          "</td><td>" +
          row.label +
          "</td><td>" +
          (row.isFD ? "是" : "否") +
          "</td><td>" +
          fmtH(row.total) +
          "</td><td>" +
          fmtH(row.fixed) +
          "</td><td>" +
          fmtH(row.flex) +
          "</td>";
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      box.appendChild(tbl);

      var sum = document.createElement("div");
      sum.className = "report-summary";
      function line(label, diff, unit) {
        var cls = diff > 0 ? "diff-pos" : diff < 0 ? "diff-neg" : "";
        var word = diff > 0 ? "多" : diff < 0 ? "少" : "持平";
        return (
          "<span class=\"" +
          cls +
          "\">" +
          label +
          "：较规定" +
          word +
          " " +
          fmtH(Math.abs(diff)) +
          unit +
          "</span>"
        );
      }
      sum.innerHTML =
        "<p><strong>周总工时</strong> " +
        fmtH(rep.totalH) +
        " h（目标 40h）<br/>" +
        line("总工时", rep.diffTotal, "h") +
        "</p>" +
        "<p><strong>固定窗口内累计</strong> " +
        fmtH(rep.fixedSlotH) +
        " h（目标约 20h，按打卡与固定日重合部分统计）<br/>" +
        line("固定窗口", rep.diffFixed, "h") +
        "</p>" +
        "<p><strong>固定日内的弹性时段</strong> " +
        fmtH(rep.flexOnFixedDaysH) +
        " h（目标约 10h，即 5 天×2h）<br/>" +
        line("固定日弹性", rep.diffFlexOnFixed, "h") +
        "</p>";
      box.appendChild(sum);
      reportContent.appendChild(box);
    });

    var rb = document.getElementById("reportBlock");
    var titleEl = document.getElementById("reportPageTitle");
    if (now.getDay() === 1) {
      rb.classList.add("monday-banner");
      titleEl.textContent = "新一周 · 上周工时总结（自动生成）";
    } else {
      rb.classList.remove("monday-banner");
      titleEl.textContent = "上周工时报告";
    }
  }

  renderReport();
  }
})();
