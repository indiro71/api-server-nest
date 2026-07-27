import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorLogAccessGuard } from './error-log-access.guard';
import { ErrorLogQuery, ErrorLogService } from './error-log.service';

@ApiTags('Error logs')
@UseGuards(ErrorLogAccessGuard)
@Controller('/error-logs')
export class ErrorLogController {
  constructor(private readonly errorLogService: ErrorLogService) {}

  @Get()
  getLogs(@Query() query: ErrorLogQuery) {
    return this.errorLogService.find(query);
  }

  @Get('/days')
  getDays() {
    return this.errorLogService.getDays();
  }

  @Get('/view')
  getView() {
    return this.renderView();
  }

  private renderView() {
    return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Error logs</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f172a;
        --panel: #111827;
        --panel-soft: #172033;
        --border: #273449;
        --text: #e5edf7;
        --muted: #94a3b8;
        --accent: #38bdf8;
        --error: #fb7185;
        --warn: #fbbf24;
        --info: #60a5fa;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: linear-gradient(180deg, #0b1220 0%, var(--bg) 100%);
        color: var(--text);
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        background: rgba(15, 23, 42, 0.9);
        position: sticky;
        top: 0;
        z-index: 2;
      }
      h1 {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }
      main { padding: 16px 20px 28px; }
      .filters {
        display: grid;
        grid-template-columns: 150px 160px 130px 1fr 100px auto;
        gap: 8px;
        margin-bottom: 14px;
      }
      input, select, button {
        min-height: 36px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--panel);
        color: var(--text);
        padding: 0 10px;
        font: inherit;
      }
      button {
        cursor: pointer;
        background: var(--accent);
        border-color: var(--accent);
        color: #082f49;
        font-weight: 600;
      }
      .summary {
        color: var(--muted);
        margin-bottom: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--panel);
        border: 1px solid var(--border);
      }
      th, td {
        border-bottom: 1px solid var(--border);
        padding: 8px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: var(--muted);
        background: var(--panel-soft);
        font-size: 12px;
        font-weight: 600;
        position: sticky;
        top: 69px;
        z-index: 1;
      }
      tr:hover td { background: rgba(56, 189, 248, 0.05); }
      .level {
        display: inline-flex;
        min-width: 48px;
        justify-content: center;
        border-radius: 999px;
        padding: 2px 8px;
        text-transform: uppercase;
        font-size: 11px;
        font-weight: 700;
      }
      .level-error, .level-fatal { background: rgba(251, 113, 133, 0.12); color: var(--error); }
      .level-warn { background: rgba(251, 191, 36, 0.12); color: var(--warn); }
      .level-info, .level-debug { background: rgba(96, 165, 250, 0.12); color: var(--info); }
      .message { white-space: pre-wrap; max-width: 520px; }
      details { max-width: 680px; }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        overflow: auto;
        max-height: 360px;
        margin: 8px 0 0;
        padding: 10px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: #0b1220;
        color: #cbd5e1;
      }
      .muted { color: var(--muted); }
      @media (max-width: 900px) {
        header { align-items: flex-start; flex-direction: column; }
        main { padding: 12px; }
        .filters { grid-template-columns: 1fr 1fr; }
        table { min-width: 900px; }
        .table-wrap { overflow-x: auto; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Error logs</h1>
      <div class="muted" id="lastUpdate">Loading...</div>
    </header>
    <main>
      <form class="filters" id="filters">
        <input type="date" id="day" />
        <input id="source" placeholder="source" />
        <select id="level">
          <option value="">all levels</option>
          <option value="fatal">fatal</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
        </select>
        <input id="search" placeholder="search message/source/url" />
        <input id="limit" type="number" min="1" max="500" value="100" />
        <button type="submit">Refresh</button>
      </form>
      <div class="summary" id="summary"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Level</th>
              <th>Source</th>
              <th>Status</th>
              <th>Route</th>
              <th>Message</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </main>
    <script>
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token') || '';
      const rows = document.getElementById('rows');
      const summary = document.getElementById('summary');
      const lastUpdate = document.getElementById('lastUpdate');
      const dayInput = document.getElementById('day');
      const apiBasePath = window.location.pathname.replace(/\\/view\\/?$/, '');

      dayInput.value = params.get('day') || new Date().toISOString().slice(0, 10);

      const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[char]));

      const formatJson = (value) => {
        if (!value) return '';
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      };

      const loadLogs = async () => {
        const query = new URLSearchParams({
          day: document.getElementById('day').value,
          source: document.getElementById('source').value,
          level: document.getElementById('level').value,
          search: document.getElementById('search').value,
          limit: document.getElementById('limit').value || '100',
        });

        if (token) {
          query.set('token', token);
        }

        const response = await fetch(apiBasePath + '?' + query.toString());

        if (!response.ok) {
          rows.innerHTML = '<tr><td colspan="7">Request failed: ' + response.status + '</td></tr>';
          summary.textContent = '';
          return;
        }

        const result = await response.json();
        summary.textContent = 'Showing ' + result.items.length + ' of ' + result.total + ' records';
        lastUpdate.textContent = 'Updated ' + new Date().toLocaleString();
        rows.innerHTML = result.items.map((item) => {
          const details = {
            context: item.context,
            meta: item.meta,
            stack: item.stack,
            userId: item.userId,
          };

          return '<tr>' +
            '<td>' + escapeHtml(new Date(item.dateCreate).toLocaleString()) + '</td>' +
            '<td><span class="level level-' + escapeHtml(item.level) + '">' + escapeHtml(item.level) + '</span></td>' +
            '<td>' + escapeHtml(item.source) + '</td>' +
            '<td>' + escapeHtml(item.status || '') + '</td>' +
            '<td>' + escapeHtml([item.method, item.url].filter(Boolean).join(' ')) + '</td>' +
            '<td class="message">' + escapeHtml(item.message) + '</td>' +
            '<td><details><summary>open</summary><pre>' + escapeHtml(formatJson(details)) + '</pre></details></td>' +
          '</tr>';
        }).join('');
      };

      document.getElementById('filters').addEventListener('submit', (event) => {
        event.preventDefault();
        loadLogs();
      });

      loadLogs();
    </script>
  </body>
</html>`;
  }
}
