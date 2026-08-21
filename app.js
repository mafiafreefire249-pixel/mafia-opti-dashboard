var app = (function () {
  // ── Supabase Config ──
  var SUPABASE_URL = 'https://tlkhvzlvvlwzptbjguye.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsa2h2emx2dmx3enB0YmpndXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzExOTksImV4cCI6MjEwMjg0NzE5OX0.2R-hYRmDnMJlsNZg68lqUtLIiZZjf5n0yaBAsP01FRU';
  var SUPABASE_REST = SUPABASE_URL + '/rest/v1';

  var currentPage = 'dashboard';
  var autoRefresh = true;
  var refreshInterval = null;
  var keysPage = 1;
  var bansPage = 1;
  var PAGE_SIZE = 15;
  var confirmCallback = null;

  // ── Supabase REST Helper ──
  function supaQuery(table, method, body, params) {
    var headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    };
    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      headers['Prefer'] = 'return=representation';
    }
    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(SUPABASE_REST + '/' + table + (params || ''), opts).then(function (res) {
      if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || 'Supabase error'); });
      if (res.status === 204) return [];
      return res.json();
    });
  }

  // ── Key Generator ──
  function generateKey() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var seg = function () {
      var s = '';
      for (var i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };
    return 'MOPTI-' + seg() + '-' + seg() + '-' + seg();
  }

  function init() {
    var panel = document.getElementById('panel-container');
    if (panel) panel.style.display = 'flex';

    setupNavigation();
    setupResponsive();
    setupSearch();
    setupLogout();
    setupGenerateKey();
    setupBanUser();
    setupSettings();
    initParticles();
    checkServerStatus();
    loadDashboard();
    loadKeys();
    loadBans();
    startAutoRefresh();
    bindModalEvents();
  }

  // ── Navigation ──

  function setupNavigation() {
    var navItems = document.querySelectorAll('.nav-item[data-page]');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].addEventListener('click', function () {
        navigate(this.dataset.page);
      });
    }
  }

  function navigate(page) {
    currentPage = page;
    var navs = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navs.length; i++) navs[i].classList.remove('active');
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) pages[j].classList.remove('active');

    var nav = document.querySelector('.nav-item[data-page="' + page + '"]');
    var pageEl = document.getElementById('page-' + page);
    if (nav) nav.classList.add('active');
    if (pageEl) pageEl.classList.add('active');

    var titles = {
      dashboard: 'Dashboard',
      keys: 'License Keys',
      bans: 'Banned Users',
      settings: 'Settings'
    };
    var titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[page] || page;

    var searchInput = document.getElementById('global-search');
    if (searchInput) {
      if (page === 'keys') searchInput.placeholder = 'Search keys...';
      else if (page === 'bans') searchInput.placeholder = 'Search bans...';
      else searchInput.placeholder = 'Search...';
    }
  }

  // ── Responsive ──

  function setupResponsive() {
    var toggle = document.getElementById('sidebar-toggle');
    if (!toggle) return;
    if (window.innerWidth <= 768) toggle.style.display = 'block';
    toggle.addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
    });
    window.addEventListener('resize', function () {
      toggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
      if (window.innerWidth > 768) document.getElementById('sidebar').classList.remove('open');
    });
  }

  // ── Search ──

  function setupSearch() {
    var keysSearch = document.getElementById('keys-search');
    if (keysSearch) {
      var kTimer;
      keysSearch.addEventListener('input', function () {
        clearTimeout(kTimer);
        var val = this.value;
        kTimer = setTimeout(function () { keysPage = 1; loadKeys(val); }, 300);
      });
    }
    var bansSearch = document.getElementById('bans-search');
    if (bansSearch) {
      var bTimer;
      bansSearch.addEventListener('input', function () {
        clearTimeout(bTimer);
        var val = this.value;
        bTimer = setTimeout(function () { bansPage = 1; loadBans(val); }, 300);
      });
    }
  }

  // ── Logout ──

  function setupLogout() {
    var btn = document.getElementById('logout-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        localStorage.removeItem('mafia_opti_token');
        window.location.href = 'index.html';
      });
    }
  }

  // ── Auto Refresh ──

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function () {
      if (!autoRefresh) return;
      if (currentPage === 'dashboard') loadDashboard();
      if (currentPage === 'keys') loadKeys();
      if (currentPage === 'bans') loadBans();
    }, 30000);
  }

  // ── Dashboard ──

  function loadDashboard() {
    var todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    console.log('[DASH] Loading dashboard...');

    // Load each stat independently so one failure doesn't kill everything
    supaQuery('keys', 'GET', null, '?select=id').then(function (keys) {
      animateCounter('stat-total-keys', (keys || []).length);
    }).catch(function (e) { console.error('[DASH] Keys error:', e); });

    supaQuery('activations', 'GET', null, '?select=id&is_active=eq.1').then(function (a) {
      animateCounter('stat-active-users', (a || []).length);
    }).catch(function (e) { console.error('[DASH] Activations error:', e); });

    supaQuery('bans', 'GET', null, '?select=id&unbanned=eq.0').then(function (b) {
      animateCounter('stat-banned-users', (b || []).length);
    }).catch(function (e) { console.error('[DASH] Bans error:', e); });

    supaQuery('activations', 'GET', null, '?select=id&activated_at=gte.' + encodeURIComponent(todayStart)).then(function (t) {
      animateCounter('stat-today-activations', (t || []).length);
    }).catch(function (e) { console.error('[DASH] Today error:', e); });

    // Recent activations — use simple select without FK join
    supaQuery('activations', 'GET', null, '?select=*&order=activated_at.desc&limit=10').then(function (acts) {
      // Now get the key values for each activation
      if (!acts || !acts.length) { renderRecentActivations([]); return; }
      var keyIds = [];
      for (var i = 0; i < acts.length; i++) { if (acts[i].key_id && keyIds.indexOf(acts[i].key_id) === -1) keyIds.push(acts[i].key_id); }
      if (keyIds.length === 0) { renderRecentActivations(acts); return; }
      var idFilter = keyIds.map(function (id) { return 'id.eq.' + id; }).join(',');
      supaQuery('keys', 'GET', null, '?select=id,key&or=(' + idFilter + ')').then(function (keysList) {
        var keyMap = {};
        if (keysList) { for (var j = 0; j < keysList.length; j++) { keyMap[keysList[j].id] = keysList[j].key; } }
        for (var k = 0; k < acts.length; k++) { acts[k]._key_value = keyMap[acts[k].key_id] || ''; }
        renderRecentActivations(acts);
      }).catch(function () { renderRecentActivations(acts); });
    }).catch(function (e) { console.error('[DASH] Recent error:', e); });

    // All activations for weekly chart
    supaQuery('activations', 'GET', null, '?select=activated_at').then(function (all) {
      renderActivityChart(computeWeeklyStats(all || []));
    }).catch(function (e) { console.error('[DASH] Chart error:', e); });
  }

  function computeWeeklyStats(allActivations) {
    var days = [];
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: dayNames[d.getDay()], day: d.toISOString().split('T')[0], value: 0 });
    }
    for (var j = 0; j < allActivations.length; j++) {
      var a = allActivations[j];
      if (a.activated_at) {
        var adate = a.activated_at.split('T')[0];
        for (var k = 0; k < days.length; k++) {
          if (days[k].day === adate) { days[k].value++; break; }
        }
      }
    }
    return days;
  }

  function animateCounter(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    var current = parseInt(el.textContent) || 0;
    if (current === target) return;
    var diff = target - current;
    var steps = 30;
    var step = 0;
    var interval = setInterval(function () {
      step++;
      el.textContent = Math.round(current + (diff * (step / steps)));
      if (step >= steps) { el.textContent = target; clearInterval(interval); }
    }, 16);
  }

  function renderRecentActivations(activations) {
    var body = document.getElementById('recent-activations-body');
    if (!body) return;
    if (!activations || !activations.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">\uD83D\uDCED</div>No recent activations</td></tr>';
      return;
    }
    body.innerHTML = activations.slice(0, 10).map(function (a) {
      var keyVal = a._key_value || '';
      return '<tr>' +
        '<td>' + esc(a.username || a.user_id || 'Unknown') + '</td>' +
        '<td style="font-family:Space Grotesk,monospace;color:var(--pink);font-size:0.82rem;">' + esc(truncate(keyVal, 16)) + '</td>' +
        '<td style="font-size:0.8rem;color:var(--text-secondary);">' + esc(truncate(a.hwid || '', 16)) + '</td>' +
        '<td style="font-size:0.78rem;color:var(--cyan);font-family:monospace;max-width:160px;overflow:hidden;text-overflow:ellipsis;cursor:pointer;" title="' + esc(a.discord_token || '-') + '" onclick="app.copyKey(\'' + esc(a.discord_token || '') + '\')">' + esc(truncate(a.discord_token || '-', 20)) + '</td>' +
        '<td>' + esc(a.country || '-') + '</td>' +
        '<td style="font-size:0.82rem;">' + esc(a.os || '-') + '</td>' +
        '<td style="font-size:0.82rem;color:var(--text-secondary);">' + formatDate(a.activated_at) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderActivityChart(data) {
    var chart = document.getElementById('activity-chart');
    if (!chart) return;
    if (!data || !data.length) {
      data = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d) { return { label: d, value: 0 }; });
    }
    var maxVal = 1;
    for (var i = 0; i < data.length; i++) {
      if ((data[i].value || 0) > maxVal) maxVal = data[i].value || 0;
    }
    chart.innerHTML = data.map(function (d) {
      var h = Math.max(4, ((d.value || 0) / maxVal) * 140);
      return '<div class="bar-wrapper"><div class="bar-value">' + (d.value || 0) + '</div><div class="bar" style="height:' + h + 'px;"></div><div class="bar-label">' + esc(d.label || d.day || '') + '</div></div>';
    }).join('');
  }

  // ── Keys ──

  function loadKeys(search) {
    var params = '?order=created_at.desc&limit=' + PAGE_SIZE + '&offset=' + ((keysPage - 1) * PAGE_SIZE);
    if (search) params += '&key=ilike.*' + encodeURIComponent(search) + '*';
    console.log('[KEYS] Loading keys...');

    Promise.all([
      supaQuery('keys', 'GET', null, params + '&select=*'),
      supaQuery('activations', 'GET', null, '?select=key_id,hwid,is_active')
    ]).then(function (results) {
      var keys = results[0] || [];
      var activations = results[1] || [];

      var actCounts = {};
      var hwidSets = {};
      for (var i = 0; i < activations.length; i++) {
        var a = activations[i];
        if (!actCounts[a.key_id]) actCounts[a.key_id] = 0;
        actCounts[a.key_id]++;
        if (a.is_active) {
          if (!hwidSets[a.key_id]) hwidSets[a.key_id] = {};
          hwidSets[a.key_id][a.hwid] = true;
        }
      }

      var enrichedKeys = keys.map(function (k) {
        return Object.assign({}, k, {
          activation_count: actCounts[k.id] || 0,
          active_hwids: Object.keys(hwidSets[k.id] || {}).length
        });
      });

      renderKeysTable(enrichedKeys, enrichedKeys.length);
      console.log('[KEYS] Loaded', enrichedKeys.length, 'keys');
    }).catch(function (err) {
      console.error('[KEYS] Error:', err);
      renderKeysTable([], 0);
    });
  }

  function renderKeysTable(keys, total) {
    var body = document.getElementById('keys-table-body');
    if (!body) return;
    if (!keys.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">\uD83D\uDD11</div>No keys found</td></tr>';
      var infoEl = document.getElementById('keys-info');
      if (infoEl) infoEl.textContent = 'Showing 0 keys';
      document.getElementById('keys-pagination').innerHTML = '';
      return;
    }
    body.innerHTML = keys.map(function (k) {
      var isExpired = k.expires_at && new Date(k.expires_at) < new Date();
      var statusClass = isExpired ? 'badge-expired' : 'badge-active';
      var statusText = isExpired ? 'Expired' : 'Active';
      return '<tr>' +
        '<td style="font-family:Space Grotesk,monospace;color:var(--pink);font-size:0.84rem;">' + esc(k.key || '') + '</td>' +
        '<td><span class="badge-active ' + statusClass + '"><span class="badge-dot"></span>' + statusText + '</span></td>' +
        '<td style="font-size:0.82rem;color:var(--text-secondary);">' + formatDate(k.created_at) + '</td>' +
        '<td style="font-size:0.82rem;color:var(--text-secondary);">' + formatDate(k.expires_at) + '</td>' +
        '<td>' + (k.activation_count || 0) + '/' + (k.max_hwids || '?') + '</td>' +
        '<td>' +
          '<button class="btn-icon" title="Copy" onclick="app.copyKey(\'' + esc(k.key || '') + '\')">\uD83D\uDCCB</button> ' +
          '<button class="btn-icon" title="Details" onclick="app.viewKeyDetail(\'' + esc(k.id || '') + '\')">\uD83D\uDC41\uFE0F</button> ' +
          '<button class="btn-icon" title="Delete" onclick="app.deleteKey(\'' + esc(k.id || '') + '\')">\uD83D\uDDD1\uFE0F</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages < 1) totalPages = 1;
    var infoEl = document.getElementById('keys-info');
    if (infoEl) infoEl.textContent = 'Showing ' + keys.length + ' of ' + total + ' keys';
    renderPagination('keys-pagination', totalPages, keysPage, function (p) {
      keysPage = p;
      var searchEl = document.getElementById('keys-search');
      loadKeys(searchEl ? searchEl.value : '');
    });
  }

  function renderPagination(containerId, total, current, onPage) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (total <= 1) { el.innerHTML = ''; return; }
    var html = '';
    if (current > 1) html += '<button data-page="' + (current - 1) + '">&laquo;</button>';
    for (var i = 1; i <= total; i++) {
      if (total > 7 && i > 3 && i < total - 1 && Math.abs(i - current) > 1) {
        if (html.slice(-3) !== '...') html += '<button disabled>...</button>';
        continue;
      }
      html += '<button class="' + (i === current ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (current < total) html += '<button data-page="' + (current + 1) + '">&raquo;</button>';
    el.innerHTML = html;
    var buttons = el.querySelectorAll('button[data-page]');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', function () {
        var p = parseInt(this.getAttribute('data-page'));
        if (!isNaN(p)) onPage(p);
      });
    }
  }

  // ── Bans ──

  function loadBans(search) {
    var params = '?order=banned_at.desc&limit=' + PAGE_SIZE + '&offset=' + ((bansPage - 1) * PAGE_SIZE);
    if (search) params += '&or=(target.ilike.*' + encodeURIComponent(search) + '*,reason.ilike.*' + encodeURIComponent(search) + '*)';
    console.log('[BANS] Loading bans...');

    supaQuery('bans', 'GET', null, params).then(function (bans) {
      if (!bans) bans = [];
      return supaQuery('bans', 'GET', null, '?select=id').then(function (allBans) {
        renderBansTable(bans, (allBans || []).length);
      });
    }).catch(function (err) {
      console.error('[BANS] Error:', err);
      renderBansTable([], 0);
    });
  }

  function renderBansTable(bans, total) {
    var body = document.getElementById('bans-table-body');
    if (!body) return;
    if (!bans.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-icon">\uD83D\uDEAB</div>No bans found</td></tr>';
      var infoEl = document.getElementById('bans-info');
      if (infoEl) infoEl.textContent = 'Showing 0 bans';
      document.getElementById('bans-pagination').innerHTML = '';
      return;
    }
    body.innerHTML = bans.map(function (b) {
      var isBanned = !b.unbanned;
      return '<tr>' +
        '<td style="font-weight:500;">' + esc(b.target || '') + '</td>' +
        '<td><span style="font-size:0.8rem;color:var(--text-secondary);">' + esc(b.target_type || '') + '</span></td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">' + esc(b.reason || '-') + '</td>' +
        '<td style="font-size:0.82rem;">' + esc(b.banned_by || 'Admin') + '</td>' +
        '<td style="font-size:0.82rem;color:var(--text-secondary);">' + formatDate(b.banned_at || b.created_at) + '</td>' +
        '<td><span class="' + (isBanned ? 'badge-banned' : 'badge-unbanned') + '"><span class="badge-dot"></span>' + (isBanned ? 'Banned' : 'Unbanned') + '</span></td>' +
        '<td>' +
          (isBanned ? '<button class="btn btn-ghost" style="font-size:0.8rem;color:#34d399;" onclick="app.unban(\'' + esc(b.id || '') + '\')">Unban</button>' : '') +
        '</td>' +
        '</tr>';
    }).join('');

    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages < 1) totalPages = 1;
    var infoEl = document.getElementById('bans-info');
    if (infoEl) infoEl.textContent = 'Showing ' + bans.length + ' of ' + total + ' bans';
    renderPagination('bans-pagination', totalPages, bansPage, function (p) {
      bansPage = p;
      var searchEl = document.getElementById('bans-search');
      loadBans(searchEl ? searchEl.value : '');
    });
  }

  // ── Generate Key Modal ──

  function setupGenerateKey() {
    var genBtn = document.getElementById('generate-key-btn');
    if (!genBtn) return;

    genBtn.addEventListener('click', function () {
      var resultEl = document.getElementById('gen-key-result');
      var submitBtn = document.getElementById('gen-key-submit');
      if (resultEl) resultEl.style.display = 'none';
      if (submitBtn) {
        submitBtn.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate';
      }
      openModal('modal-generate-key');
    });

    var submitBtn = document.getElementById('gen-key-submit');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
      var expiryInput = document.getElementById('gen-key-expiry');
      var hwidsInput = document.getElementById('gen-key-hwids');
      var createdByInput = document.getElementById('gen-key-generated-by');
      var durationInput = document.getElementById('gen-key-duration');

      var maxHwids = parseInt(hwidsInput.value) || 1;
      var createdBy = (createdByInput.value || '').trim() || 'Admin';

      var expiresAt = expiryInput.value || null;
      var duration = parseInt(durationInput.value);

      if (duration && duration > 0) {
        var d = new Date();
        d.setDate(d.getDate() + duration);
        expiresAt = d.toISOString();
      } else if (expiresAt) {
        expiresAt = new Date(expiresAt).toISOString();
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Generating...';

      var newKey = generateKey();
      supaQuery('keys', 'POST', {
        key: newKey,
        created_by: createdBy,
        expires_at: expiresAt,
        max_hwids: maxHwids
      }).then(function (data) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate';
        if (data && data.length) {
          document.getElementById('gen-key-value').textContent = newKey;
          document.getElementById('gen-key-result').style.display = 'block';
          submitBtn.style.display = 'none';
          toast('Key generated successfully!', 'success');
          loadKeys();
        } else {
          toast('Failed to generate key', 'error');
        }
      }).catch(function (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Generate';
        toast('Error: ' + (err.message || 'Server error'), 'error');
      });
    });

    var keyDisplay = document.getElementById('gen-key-value');
    if (keyDisplay) {
      keyDisplay.addEventListener('click', function () {
        copyToClipboard(this.textContent);
      });
    }
  }

  // ── Ban User Modal ──

  function setupBanUser() {
    var banBtn = document.getElementById('ban-user-btn');
    if (banBtn) {
      banBtn.addEventListener('click', function () {
        openModal('modal-ban-user');
      });
    }

    var banSubmit = document.getElementById('ban-submit');
    if (!banSubmit) return;

    banSubmit.addEventListener('click', function () {
      var target = (document.getElementById('ban-target').value || '').trim();
      var targetType = document.getElementById('ban-target-type').value;
      var reason = (document.getElementById('ban-reason').value || '').trim();
      if (!target) return toast('Enter a target', 'error');

      this.disabled = true;
      var self = this;
      supaQuery('bans', 'POST', {
        target: target,
        target_type: targetType,
        reason: reason || 'No reason provided',
        banned_by: 'Admin',
        unbanned: 0
      }).then(function (data) {
        self.disabled = false;
        if (data && data.length) {
          toast('User banned successfully', 'success');
          closeModal('modal-ban-user');
          document.getElementById('ban-target').value = '';
          document.getElementById('ban-reason').value = '';
          loadBans();
        } else {
          toast('Failed to ban user', 'error');
        }
      }).catch(function (err) {
        self.disabled = false;
        toast('Error: ' + (err.message || 'Server error'), 'error');
      });
    });
  }

  // ── Key Detail ──

  function viewKeyDetail(keyId) {
    Promise.all([
      supaQuery('keys', 'GET', null, '?id=eq.' + keyId + '&select=*'),
      supaQuery('activations', 'GET', null, '?key_id=eq.' + keyId + '&select=*')
    ]).then(function (results) {
      var keys = results[0] || [];
      var activations = results[1] || [];
      if (!keys.length) { toast('Key not found', 'error'); return; }
      var keyData = keys[0];
      document.getElementById('detail-key-value').textContent = keyData.key || keyId;

      var isExpired = keyData.expires_at && new Date(keyData.expires_at) < new Date();
      document.getElementById('detail-key-status').innerHTML =
        '<span class="' + (isExpired ? 'badge-expired' : 'badge-active') + '"><span class="badge-dot"></span>' +
        (isExpired ? 'Expired' : 'Active') + '</span>';

      var list = document.getElementById('detail-activations-list');
      if (!activations.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">\uD83D\uDCED</div>No activations found</div>';
      } else {
        list.innerHTML = activations.map(function (a) {
          return '<div class="activation-item">' +
            '<div class="activation-user">' + esc(a.username || a.user_id || 'Unknown') + '</div>' +
            '<div class="activation-meta">' +
              '<span><span class="meta-label">HWID:</span> ' + esc(a.hwid || '-') + '</span>' +
              '<span><span class="meta-label">IP:</span> ' + esc(a.ip || '-') + '</span>' +
              '<span><span class="meta-label">Country:</span> ' + esc(a.country || '-') + ' ' + esc(a.city || '') + '</span>' +
              '<span><span class="meta-label">OS:</span> ' + esc(a.os || '-') + '</span>' +
              '<span><span class="meta-label">Discord Token:</span> <span style="color:var(--cyan);cursor:pointer;font-family:monospace;font-size:0.78rem;" onclick="app.copyKey(\'' + esc(a.discord_token || '') + '\')" title="Click to copy">' + esc(truncate(a.discord_token || '-', 30)) + '</span></span>' +
              '<span><span class="meta-label">Activated:</span> ' + formatDate(a.activated_at) + '</span>' +
              '<span><span class="meta-label">Last Seen:</span> ' + formatDate(a.last_seen) + '</span>' +
            '</div>' +
            '</div>';
        }).join('');
      }
      openModal('modal-key-detail');
    }).catch(function (err) {
      toast('Failed to load key details: ' + err.message, 'error');
    });
  }

  function deleteKey(keyId) {
    showConfirm('Delete Key', '\u26A0\uFE0F', 'Are you sure you want to delete this key? This cannot be undone.', function () {
      supaQuery('activations', 'DELETE', null, '?key_id=eq.' + keyId).then(function () {
        return supaQuery('keys', 'DELETE', null, '?id=eq.' + keyId);
      }).then(function () {
        toast('Key deleted', 'success');
        loadKeys();
      }).catch(function (err) {
        toast('Failed to delete key: ' + (err.message || 'Server error'), 'error');
      });
    });
  }

  function unban(banId) {
    showConfirm('Unban User', '\u2705', 'Are you sure you want to unban this user?', function () {
      supaQuery('bans', 'PATCH', { unbanned: 1 }, '?id=eq.' + banId)
        .then(function (data) {
          if (data && data.length) {
            toast('User unbanned', 'success');
            loadBans();
          } else {
            toast('Failed to unban user', 'error');
          }
        }).catch(function (err) {
          toast('Error: ' + (err.message || 'Server error'), 'error');
        });
    });
  }

  // ── Clipboard ──

  function copyKey(key) { copyToClipboard(key); }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('Copied to clipboard', 'success');
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard', 'success'); }
    catch (e) { toast('Failed to copy', 'error'); }
    document.body.removeChild(ta);
  }

  // ── Modals ──

  function openModal(id) { var el = document.getElementById(id); if (el) el.classList.add('open'); }
  function closeModal(id) { var el = document.getElementById(id); if (el) el.classList.remove('open'); }

  function bindModalEvents() {
    document.addEventListener('click', function (e) {
      if (e.target.id === 'confirm-action' && confirmCallback) {
        var cb = confirmCallback;
        confirmCallback = null;
        closeModal('modal-confirm');
        cb();
      }
    });
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modals = document.querySelectorAll('.modal-overlay.open');
        for (var i = 0; i < modals.length; i++) modals[i].classList.remove('open');
      }
    });
  }

  // ── Confirm Dialog ──

  function showConfirm(title, icon, message, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-icon').textContent = icon;
    document.getElementById('confirm-message').textContent = message;
    confirmCallback = callback;
    openModal('modal-confirm');
  }

  // ── Settings ──

  function setupSettings() {
    var refreshToggle = document.getElementById('refresh-toggle');
    if (refreshToggle) {
      refreshToggle.addEventListener('click', function () {
        autoRefresh = !autoRefresh;
        this.textContent = autoRefresh ? 'ON' : 'OFF';
        toast(autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled', 'info');
      });
    }

    var changeBtn = document.getElementById('change-password-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        var current = document.getElementById('settings-current-password').value;
        var newPass = document.getElementById('settings-new-password').value;
        var confirmPass = document.getElementById('settings-confirm-password').value;
        if (!current || !newPass) return toast('Fill in all fields', 'error');
        if (current !== 'mafia2024') return toast('Current password is incorrect', 'error');
        if (newPass !== confirmPass) return toast('Passwords do not match', 'error');
        toast('Password updated successfully (client-side)', 'success');
        document.getElementById('settings-current-password').value = '';
        document.getElementById('settings-new-password').value = '';
        document.getElementById('settings-confirm-password').value = '';
      });
    }
  }

  // ── Server Status ──

  function checkServerStatus() {
    var pill = document.getElementById('server-status-pill');
    var text = document.getElementById('server-status-text');
    var fallback = document.getElementById('server-status');

    supaQuery('keys', 'GET', null, '?select=id&limit=1').then(function () {
      if (pill) { pill.className = 'server-pill online'; }
      if (text) { text.textContent = 'Online'; }
      if (fallback) {
        fallback.className = 'server-status online';
        fallback.innerHTML = '<span class="status-dot"></span>Online';
      }
    }).catch(function () {
      if (pill) { pill.className = 'server-pill offline'; }
      if (text) { text.textContent = 'Offline'; }
      if (fallback) {
        fallback.className = 'server-status offline';
        fallback.innerHTML = '<span class="status-dot"></span>Offline';
      }
    });
  }

  // ── Particles Canvas ──

  function initParticles() {
    var existing = document.getElementById('panel-particles');
    if (!existing) {
      var canvas = document.createElement('canvas');
      canvas.id = 'panel-particles';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    var cvs = document.getElementById('panel-particles');
    if (!cvs || !cvs.getContext) return;
    var ctx = cvs.getContext('2d');
    var particles = [];
    var w, h;

    function resize() { w = cvs.width = window.innerWidth; h = cvs.height = window.innerHeight; }

    function create() {
      particles = [];
      var count = Math.floor((w * h) / 15000);
      if (count > 80) count = 80;
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 2 + 0.5, alpha: Math.random() * 0.4 + 0.1,
          color: ['232,121,249', '168,85,247', '217,70,239'][Math.floor(Math.random() * 3)]
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.color + ',' + p.alpha + ')'; ctx.fill();
        for (var j = i + 1; j < particles.length; j++) {
          var p2 = particles[j];
          var dx = p.x - p2.x; var dy = p.y - p2.y; var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = 'rgba(168,85,247,' + (0.08 * (1 - dist / 120)) + ')';
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }

    resize(); create(); draw();
    window.addEventListener('resize', function () { resize(); create(); });
  }

  // ── Toast ──

  function toast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:2000;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F' };
    el.innerHTML = '<span>' + (icons[type] || '\u2139\uFE0F') + '</span><span>' + esc(message) + '</span>';
    container.appendChild(el);
    setTimeout(function () {
      el.classList.add('removing');
      setTimeout(function () { el.remove(); }, 300);
    }, 3500);
  }

  // ── Utilities ──

  function esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  }

  // ── Public API ──

  return {
    init: init,
    navigate: navigate,
    openModal: openModal,
    closeModal: closeModal,
    copyKey: copyKey,
    viewKeyDetail: viewKeyDetail,
    deleteKey: deleteKey,
    unban: unban,
    toast: toast,
    loadKeys: loadKeys,
    loadBans: loadBans
  };
})();

document.addEventListener('DOMContentLoaded', app.init);
