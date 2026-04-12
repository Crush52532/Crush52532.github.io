/**
 * 工时统计：固定段 14:00–17:00、20:00–21:00；周目标 40h、固定段合计目标 20h
 */
(function (global) {
  var MS = 60000;

  function atTime(d, h, m) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
    return x.getTime();
  }

  /** 与 [dayStart, dayEnd] 窗口的重叠分钟数 */
  function overlapMin(t0, t1, w0, w1) {
    var a = Math.max(t0, w0);
    var b = Math.min(t1, w1);
    if (b <= a) return 0;
    return (b - a) / MS;
  }

  /** 周一=0 … 周日=6 */
  function weekdayMon0(d) {
    var wd = d.getDay();
    return wd === 0 ? 6 : wd - 1;
  }

  global.Worktime = {
    TARGET_TOTAL_H: 40,
    TARGET_FIXED_SLOT_H: 20,
    TARGET_FLEX_ON_FIXED_DAYS_H: 10,

    weekdayMon0: weekdayMon0,

    /** 某日 14:00–17:00 与会话重叠分钟 */
    overlapAfternoon: function (dayDate, start, end) {
      var t0 = start.getTime();
      var t1 = end.getTime();
      var w0 = atTime(dayDate, 14, 0);
      var w1 = atTime(dayDate, 17, 0);
      return overlapMin(t0, t1, w0, w1);
    },

    overlapEvening: function (dayDate, start, end) {
      var t0 = start.getTime();
      var t1 = end.getTime();
      var w0 = atTime(dayDate, 20, 0);
      var w1 = atTime(dayDate, 21, 0);
      return overlapMin(t0, t1, w0, w1);
    },

    sessionTotalMin: function (startISO, endISO) {
      var a = new Date(startISO).getTime();
      var b = new Date(endISO).getTime();
      if (b <= a) return 0;
      return (b - a) / MS;
    },

    /**
     * 拆分会话到「自然日」并累计重叠（跨天会话按天切开）
     * fixedDayForDate: 该日是否为固定工作日（由周配置决定）
     */
    accumulateSession: function (acc, startISO, endISO, fixedDayForDateFn) {
      var s = new Date(startISO);
      var e = new Date(endISO);
      if (e <= s) return;

      var cur = new Date(s);
      cur.setHours(0, 0, 0, 0);
      var endMs = e.getTime();

      while (cur.getTime() < endMs) {
        var dayEnd = new Date(cur);
        dayEnd.setDate(dayEnd.getDate() + 1);
        var chunkStart = Math.max(s.getTime(), cur.getTime());
        var chunkEnd = Math.min(endMs, dayEnd.getTime());
        if (chunkEnd > chunkStart) {
          var cs = new Date(chunkStart);
          var ce = new Date(chunkEnd);
          var key =
            cs.getFullYear() +
            "-" +
            String(cs.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(cs.getDate()).padStart(2, "0");
          if (!acc.byDay[key]) {
            acc.byDay[key] = {
              totalMin: 0,
              fixedPmMin: 0,
              fixedEveMin: 0,
              flexMin: 0,
              isFixedDay: fixedDayForDateFn(cs)
            };
          }
          var day0 = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate());
          var pm = this.overlapAfternoon(day0, cs, ce);
          var ev = this.overlapEvening(day0, cs, ce);
          var total = (chunkEnd - chunkStart) / MS;
          var flex = Math.max(0, total - pm - ev);
          acc.byDay[key].totalMin += total;
          acc.byDay[key].fixedPmMin += pm;
          acc.byDay[key].fixedEveMin += ev;
          acc.byDay[key].flexMin += flex;
        }
        cur.setDate(cur.getDate() + 1);
        cur.setHours(0, 0, 0, 0);
      }
    },

    buildWeekAccumulator: function () {
      return { byDay: {} };
    },

    /** 上周一 0:00 与 本周一 0:00 */
    lastWeekRange: function (now) {
      var mon = global.StudioStore.mondayOfWeek(now);
      var lastMon = new Date(mon);
      lastMon.setDate(lastMon.getDate() - 7);
      var thisMon = new Date(mon);
      return { start: lastMon, end: thisMon };
    },

    /**
     * 生成周报：employee, weekStart=上周一
     */
    buildReport: function (employee, weekStartMonday, sessions, fixedDaysMon0) {
      var weekEnd = new Date(weekStartMonday);
      weekEnd.setDate(weekEnd.getDate() + 7);

      function isFixedForDate(d) {
        var idx = weekdayMon0(d);
        return !!fixedDaysMon0[idx];
      }

      var acc = this.buildWeekAccumulator();
      sessions.forEach(
        function (sess) {
          if (sess.employee !== employee || !sess.end) return;
          var st = new Date(sess.start);
          var en = new Date(sess.end);
          if (en <= st) return;
          if (
            en.getTime() <= weekStartMonday.getTime() ||
            st.getTime() >= weekEnd.getTime()
          )
            return;

          var s2 = st < weekStartMonday ? weekStartMonday : st;
          var e2 = en > weekEnd ? weekEnd : en;
          if (e2.getTime() <= s2.getTime()) return;

          this.accumulateSession(
            acc,
            s2.toISOString(),
            e2.toISOString(),
            isFixedForDate
          );
        }.bind(this)
      );

      var dayKeys = Object.keys(acc.byDay).sort();
      var days = [];
      var sumTotal = 0;
      var sumFixedSlot = 0;
      var sumFlex = 0;
      var flexOnFixedDays = 0;

      dayKeys.forEach(function (k) {
        var o = acc.byDay[k];
        var fd = o.isFixedDay;
        var fixedSlotMin = o.fixedPmMin + o.fixedEveMin;
        sumTotal += o.totalMin;
        sumFixedSlot += fixedSlotMin;
        sumFlex += o.flexMin;
        if (fd) flexOnFixedDays += o.flexMin;
        days.push({
          key: k,
          totalH: o.totalMin / 60,
          fixedSlotH: fixedSlotMin / 60,
          flexH: o.flexMin / 60,
          isFixedDay: fd
        });
      });

      var totalH = sumTotal / 60;
      var fixedSlotH = sumFixedSlot / 60;
      var flexH = sumFlex / 60;
      var flexOnFixedH = flexOnFixedDays / 60;

      return {
        weekStart: weekStartMonday,
        days: days,
        totalH: totalH,
        fixedSlotH: fixedSlotH,
        flexH: flexH,
        flexOnFixedDaysH: flexOnFixedH,
        diffTotal: totalH - this.TARGET_TOTAL_H,
        diffFixed: fixedSlotH - this.TARGET_FIXED_SLOT_H,
        diffFlexOnFixed: flexOnFixedH - this.TARGET_FLEX_ON_FIXED_DAYS_H
      };
    }
  };
})(typeof window !== "undefined" ? window : this);
