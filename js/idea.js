(function () {
  var S = window.StudioStore;
  if (!S) return;

  if (!S.checkAuth()) {
    window.location.href = "index.html";
    return;
  }

  var emp = S.getEmployee();
  if (emp !== "H" && emp !== "W") {
    window.location.href = "select.html";
    return;
  }

  function bootWhenCloudReady() {
    var badge = document.getElementById("empBadge");
    if (badge) {
      badge.textContent = "正在连接云端…";
      badge.className = "badge";
    }
    S.init()
      .then(function () {
        run();
      })
      .catch(function (e) {
        console.error(e);
        setTimeout(bootWhenCloudReady, 2000);
      });
  }

  function fmt(iso) {
    var d = new Date(iso);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var min = String(d.getMinutes()).padStart(2, "0");
    return m + "-" + day + " " + h + ":" + min;
  }

  function run() {
    S.touchAuth();
    document.body.classList.add(emp === "H" ? "theme-h" : "theme-w");
    var badge = document.getElementById("empBadge");
    if (badge) {
      badge.textContent = "当前：" + emp + " · 云端";
      badge.classList.add(emp === "H" ? "h" : "w");
    }
    document.getElementById("btnLogout").addEventListener("click", function () {
      S.clearAuth();
      window.location.href = "index.html";
    });

    var listEl = document.getElementById("ideaList");
    var hint = document.getElementById("ideaHint");
    var ideaSearchInput = document.getElementById("ideaSearchInput");
    var ideaDateFrom = document.getElementById("ideaDateFrom");
    var ideaDateTo = document.getElementById("ideaDateTo");
    var ideaCache = [];
    var editingIdeaId = null;

    function dateKeyFromIso(iso) {
      var d = new Date(iso || Date.now());
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, "0");
      var day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }

    function applyIdeaFilter(list) {
      var q = String((ideaSearchInput && ideaSearchInput.value) || "").trim().toLowerCase();
      var from = (ideaDateFrom && ideaDateFrom.value) || "";
      var to = (ideaDateTo && ideaDateTo.value) || "";
      return list.filter(function (it) {
        if (q && String(it.content || "").toLowerCase().indexOf(q) < 0) return false;
        var day = dateKeyFromIso(it.updatedAt || it.createdAt);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      });
    }

    function renderIdeasFromCache() {
      listEl.innerHTML = "";
      var items = applyIdeaFilter(ideaCache);
      if (!items.length) {
        var empty = document.createElement("li");
        empty.textContent = ideaCache.length ? "当前筛选条件下没有灵感记录" : "还没有灵感记录";
        listEl.appendChild(empty);
        return;
      }
      items.forEach(function (it) {
        var li = document.createElement("li");
        li.style.display = "block";
        var contentWrap = document.createElement("div");
        var isEditing = editingIdeaId === it.id;
        var ta = null;
        if (isEditing) {
          ta = document.createElement("textarea");
          ta.className = "modal-textarea";
          ta.rows = 3;
          ta.value = it.content || "";
          contentWrap.appendChild(ta);
        } else {
          var p = document.createElement("div");
          p.className = "week-detail-main";
          p.textContent = it.content || "";
          p.style.whiteSpace = "pre-wrap";
          contentWrap.appendChild(p);
        }
        var meta = document.createElement("div");
        meta.className = "week-detail-sub";
        meta.textContent = "更新于 " + fmt(it.updatedAt || it.createdAt);
        var btnRow = document.createElement("div");
        btnRow.className = "weekday-edit-actions";
        if (isEditing) {
          var save = document.createElement("button");
          save.type = "button";
          save.className = "btn btn-primary";
          save.textContent = "保存修改";
          save.addEventListener("click", function () {
            S.updateIdea(it.id, ta.value)
              .then(function () {
                editingIdeaId = null;
                hint.textContent = "已保存";
                hint.style.color = "#0d9488";
                reloadIdeas();
              })
              .catch(function (e) {
                hint.textContent = (e && e.message) || "保存失败";
                hint.style.color = "#dc2626";
              });
          });
          var cancel = document.createElement("button");
          cancel.type = "button";
          cancel.className = "btn btn-ghost";
          cancel.textContent = "取消";
          cancel.addEventListener("click", function () {
            editingIdeaId = null;
            renderIdeasFromCache();
          });
          btnRow.appendChild(save);
          btnRow.appendChild(cancel);
        } else {
          var edit = document.createElement("button");
          edit.type = "button";
          edit.className = "btn btn-ghost";
          edit.textContent = "修改";
          edit.addEventListener("click", function () {
            editingIdeaId = it.id;
            renderIdeasFromCache();
          });
          var del = document.createElement("button");
          del.type = "button";
          del.className = "btn btn-ghost";
          del.textContent = "删除";
          del.addEventListener("click", function () {
            S.deleteIdea(it.id)
              .then(function () {
                hint.textContent = "已删除";
                hint.style.color = "#0d9488";
                if (editingIdeaId === it.id) editingIdeaId = null;
                reloadIdeas();
              })
              .catch(function (e) {
                hint.textContent = (e && e.message) || "删除失败";
                hint.style.color = "#dc2626";
              });
          });
          btnRow.appendChild(edit);
          btnRow.appendChild(del);
        }
        li.appendChild(contentWrap);
        li.appendChild(meta);
        li.appendChild(btnRow);
        listEl.appendChild(li);
      });
    }

    function reloadIdeas() {
      return S.getIdeas(emp)
        .then(function (items) {
          ideaCache = items || [];
          renderIdeasFromCache();
        })
        .catch(function (e) {
          hint.textContent = (e && e.message) || "读取失败";
          hint.style.color = "#dc2626";
        });
    }

    document.getElementById("ideaForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("ideaInput");
      var text = String(input.value || "").trim();
      if (!text) {
        hint.textContent = "请输入灵感内容";
        hint.style.color = "#dc2626";
        return;
      }
      S.addIdea(emp, text)
        .then(function (item) {
          if (!item) return;
          input.value = "";
          hint.textContent = "保存成功";
          hint.style.color = "#0d9488";
          reloadIdeas();
        })
        .catch(function (e) {
          hint.textContent = (e && e.message) || "保存失败";
          hint.style.color = "#dc2626";
        });
    });

    if (ideaSearchInput) {
      ideaSearchInput.addEventListener("input", renderIdeasFromCache);
    }
    if (ideaDateFrom) {
      ideaDateFrom.addEventListener("change", renderIdeasFromCache);
    }
    if (ideaDateTo) {
      ideaDateTo.addEventListener("change", renderIdeasFromCache);
    }
    var btnIdeaFilterClear = document.getElementById("btnIdeaFilterClear");
    if (btnIdeaFilterClear) {
      btnIdeaFilterClear.addEventListener("click", function () {
        if (ideaSearchInput) ideaSearchInput.value = "";
        if (ideaDateFrom) ideaDateFrom.value = "";
        if (ideaDateTo) ideaDateTo.value = "";
        renderIdeasFromCache();
      });
    }

    reloadIdeas();
  }

  bootWhenCloudReady();
})();
