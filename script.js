const TEXT = {
  totalRecords: '近一年备案总数',
  ytdRecords: 'YTD 备案总数',
  latestWeek: '最新周备案',
  sinceStart: '仅统计近一年的数据',
  ytdHint: '按最新年份统计',
  empty: '暂无',
  latestRecord: 'LAST RECORD ',
  noLatestRecord: 'NO RECORD DATE',
  recordSeries: '备案数量',
  pivotManager: '管理人',
  pivotYtd: 'YTD',
  pivotTotal: '近一年',
  pivotMonthlyTotal: '当月求和',
  noMatches: '没有匹配的记录',
  prev: '上一页',
  next: '下一页',
  page: '第',
  of: '页，共',
  rows: '条',
  loadFailed: '数据加载失败：',
};

const appState = {
  dashboard: null,
  records: [],
  page: 1,
  pageSize: 12,
  charts: {},
  searchTimer: null,
  managerTimer: null,
  theme: 'dark',
};

Chart.defaults.font.family = "'JetBrains Mono', 'Noto Sans SC', sans-serif";

const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
}

function toDateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatter.format(date);
}

async function apiJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function destroyChart(key) {
  if (appState.charts[key]) {
    appState.charts[key].destroy();
    appState.charts[key] = null;
  }
}

function applyTheme(theme) {
  appState.theme = theme === 'light' ? 'light' : 'dark';
  document.body.dataset.theme = appState.theme;
  Chart.defaults.color = appState.theme === 'light' ? '#57606a' : '#3d5470';
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = appState.theme === 'light' ? '深色' : '浅色';
  localStorage.setItem('pfund-theme', appState.theme);
  if (appState.dashboard) renderCharts();
}

function renderSummary(summary) {
  const cards = [
    { label: TEXT.totalRecords, value: summary.recent_year_records ?? 0, hint: TEXT.sinceStart },
    { label: TEXT.ytdRecords, value: summary.ytd_records ?? 0, hint: TEXT.ytdHint },
    { label: TEXT.latestWeek, value: summary.latest_week_records ?? 0, hint: summary.latest_week || TEXT.empty },
  ];
  document.getElementById('summaryGrid').innerHTML = cards.map((item) => `
    <article class="stat">
      <div class="stat-label">${escapeHtml(item.label)}</div>
      <div class="stat-value">${Number(item.value || 0).toLocaleString()}</div>
      <div class="stat-hint">${escapeHtml(item.hint)}</div>
    </article>
  `).join('');
  document.getElementById('chartMeta').textContent = summary.latest_record_date
    ? `${TEXT.latestRecord}${toDateLabel(summary.latest_record_date)}`
    : TEXT.noLatestRecord;
}

function getManagerFilters() {
  return {
    keyword: document.getElementById('managerKeywordInput').value.trim(),
  };
}

function chartScales() {
  const gridColor = appState.theme === 'light' ? '#d8dee4' : '#182030';
  const tickColor = appState.theme === 'light' ? '#57606a' : '#3d5470';
  return {
    x: {
      grid: { color: gridColor },
      ticks: { color: tickColor, maxRotation: 0, autoSkip: true, font: { size: 9 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor },
      ticks: { color: tickColor, precision: 0, font: { size: 9 } },
    },
  };
}

function renderCharts() {
  const weekly = appState.dashboard.weekly_series || [];
  const monthly = appState.dashboard.monthly_series || [];
  const weeklyFill = appState.theme === 'light' ? 'rgba(9, 105, 218, 0.14)' : 'rgba(0, 212, 168, 0.14)';
  const weeklyStroke = appState.theme === 'light' ? '#0969da' : '#00d4a8';
  const monthlyFill = appState.theme === 'light' ? 'rgba(31, 136, 61, 0.14)' : 'rgba(59, 130, 246, 0.14)';
  const monthlyStroke = appState.theme === 'light' ? '#1f883d' : '#3b82f6';

  destroyChart('weekly');
  appState.charts.weekly = new Chart(document.getElementById('weeklyChart'), {
    type: 'bar',
    data: {
      labels: weekly.map((item) => item.week),
      datasets: [{
        label: TEXT.recordSeries,
        data: weekly.map((item) => item.record_count),
        backgroundColor: weeklyFill,
        borderColor: weeklyStroke,
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: chartScales(),
    },
  });

  destroyChart('monthly');
  appState.charts.monthly = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: monthly.map((item) => item.month),
      datasets: [{
        label: TEXT.recordSeries,
        data: monthly.map((item) => item.record_count),
        backgroundColor: monthlyFill,
        borderColor: monthlyStroke,
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: chartScales(),
    },
  });
}

function pivotColor(value) {
  const num = Number(value || 0);
  if (!num) return 'transparent';
  const alpha = Math.min(0.75, 0.08 + Math.log10(num + 1) / 4);
  return `rgba(59, 130, 246, ${alpha})`;
}

function renderManagerMonthly() {
  const pivot = appState.dashboard.manager_pivot || {};
  const years = pivot.years || [];
  const months = pivot.months || [];
  const summaryRow = pivot.summary_row || { months: {}, ytd: 0, total: 0 };
  const rows = pivot.rows || [];

  const header = [];
  header.push('<tr>');
  header.push(`<th rowspan="2" class="pivot-manager">${TEXT.pivotManager}</th>`);
  years.forEach((year) => {
    const count = months.filter((month) => month.startsWith(String(year))).length;
    header.push(`<th colspan="${count}" class="pivot-year">${year}年</th>`);
  });
  header.push(`<th rowspan="2" class="pivot-ytd">${TEXT.pivotYtd}</th>`);
  header.push(`<th rowspan="2" class="pivot-total">${TEXT.pivotTotal}</th>`);
  header.push('</tr>');

  header.push('<tr>');
  months.forEach((month) => {
    header.push(`<th class="pivot-month">${escapeHtml(month.slice(5))}</th>`);
  });
  header.push('</tr>');
  document.getElementById('managerPivotHead').innerHTML = header.join('');

  const body = [];
  body.push('<tr class="pivot-summary">');
  body.push(`<td class="pivot-manager">${TEXT.pivotMonthlyTotal}</td>`);
  months.forEach((month) => {
    body.push(`<td class="pivot-grand">${Number(summaryRow.months?.[month] || 0).toLocaleString()}</td>`);
  });
  body.push(`<td class="pivot-ytd">${Number(summaryRow.ytd || 0).toLocaleString()}</td>`);
  body.push(`<td class="pivot-total">${Number(summaryRow.total || 0).toLocaleString()}</td>`);
  body.push('</tr>');

  rows.slice(0, 120).forEach((item) => {
    body.push('<tr>');
    body.push(`<td class="pivot-manager">${escapeHtml(item.manager_name || '-')}</td>`);
    months.forEach((month) => {
      const value = item.months?.[month] || 0;
      body.push(`<td class="pivot-cell" style="background-color: ${pivotColor(value)}">${value ? Number(value).toLocaleString() : ''}</td>`);
    });
    body.push(`<td class="pivot-ytd">${Number(item.ytd || 0).toLocaleString()}</td>`);
    body.push(`<td class="pivot-total">${Number(item.total || 0).toLocaleString()}</td>`);
    body.push('</tr>');
  });
  document.getElementById('managerPivotBody').innerHTML = body.join('');
}

async function loadRecords(page = 1) {
  const keyword = document.getElementById('keywordInput').value.trim();
  const params = new URLSearchParams({
    page: String(page),
    size: String(appState.pageSize),
  });
  if (keyword) params.set('q', keyword);
  const payload = await apiJson(`/api/records?${params.toString()}`);
  appState.records = payload.items || [];
  appState.page = payload.page || page;
  return payload;
}

function renderTable() {
  const body = document.getElementById('recordsBody');
  body.innerHTML = appState.records.map((item) => `
    <tr>
      <td data-label="备案日期">${escapeHtml(toDateLabel(item.putOnRecordDate))}</td>
      <td data-label="基金代码">${escapeHtml(item.fundNo || '-')}</td>
      <td data-label="基金名称" title="${escapeHtml(item.fundName || '')}">${escapeHtml(item.fundName || '-')}</td>
      <td data-label="管理人" title="${escapeHtml(item.managerName || '')}${item.registerNo ? ' / ' + escapeHtml(item.registerNo) : ''}">
        <div class="cell-main">${escapeHtml(item.managerShortName || item.managerName || '-')}</div>
        <div class="cell-sub">${escapeHtml(item.managerName || '')}${item.registerNo ? ' / ' + escapeHtml(item.registerNo) : ''}</div>
      </td>
      <td data-label="管理类型">${escapeHtml(item.managerType || '-')}</td>
      <td data-label="运作状态">${escapeHtml(item.workingState || '-')}</td>
      <td data-label="委托人">${escapeHtml(item.mandatorName || '-')}</td>
    </tr>
  `).join('');
  if (!appState.records.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">${TEXT.noMatches}</td></tr>`;
  }
}

function renderPager(total) {
  const pager = document.getElementById('pager');
  const totalPages = Math.max(1, Math.ceil(total / appState.pageSize));
  pager.innerHTML = `
    <button class="btn" id="prevPage" ${appState.page <= 1 ? 'disabled' : ''}>${TEXT.prev}</button>
    <span class="pager-meta">${TEXT.page} ${appState.page} / ${totalPages} ${TEXT.of} ${Number(total || 0).toLocaleString()} ${TEXT.rows}</span>
    <button class="btn" id="nextPage" ${appState.page >= totalPages ? 'disabled' : ''}>${TEXT.next}</button>
  `;
  document.getElementById('prevPage').onclick = async () => {
    if (appState.page > 1) await refresh(appState.page - 1, false);
  };
  document.getElementById('nextPage').onclick = async () => {
    if (appState.page < totalPages) await refresh(appState.page + 1, false);
  };
}

async function refresh(page = 1, reloadDashboard = true) {
  if (reloadDashboard || !appState.dashboard) {
    const { keyword } = getManagerFilters();
    const params = new URLSearchParams();
    if (keyword) params.set('manager_q', keyword);
    const path = params.toString() ? `/api/dashboard?${params.toString()}` : '/api/dashboard';
    appState.dashboard = await apiJson(path);
    renderSummary(appState.dashboard.summary || {});
    renderCharts();
    renderManagerMonthly();
  }
  const payload = await loadRecords(page);
  renderTable();
  renderPager(payload.total || 0);
}

function bindEvents() {
  const bind = (id, eventName, handler) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(eventName, handler);
  };

  bind('keywordInput', 'input', () => {
    clearTimeout(appState.searchTimer);
    appState.searchTimer = setTimeout(() => refresh(1, false), 250);
  });

  bind('managerKeywordInput', 'input', () => {
    clearTimeout(appState.managerTimer);
    appState.managerTimer = setTimeout(() => refresh(1, true), 250);
  });

  bind('managerPivotExportBtn', 'click', () => {
    const { keyword } = getManagerFilters();
    const params = new URLSearchParams();
    if (keyword) params.set('manager_q', keyword);
    const url = params.toString() ? `/api/manager-pivot.xlsx?${params.toString()}` : '/api/manager-pivot.xlsx';
    window.location.href = url;
  });

  bind('themeToggleBtn', 'click', () => {
    applyTheme(appState.theme === 'light' ? 'dark' : 'light');
  });

  bind('refreshBtn', 'click', async () => {
    await refresh(1, true);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    applyTheme(localStorage.getItem('pfund-theme') || 'dark');
    bindEvents();
    await refresh(1, true);
  } catch (error) {
    document.body.innerHTML = `<pre class="load-error">${TEXT.loadFailed}${escapeHtml(error.message)}</pre>`;
  }
});
