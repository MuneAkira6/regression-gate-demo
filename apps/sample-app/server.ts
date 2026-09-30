// Acme Tasks — the sample app under test. node:http only, no framework, data seeded in memory.
// goal-pack/SCOPE.md is the authority for every route: when this file and the contract disagree,
// this file is the one that is wrong.
//
// Two behaviours here exist for the demonstration rather than for a user:
//   - the today counter on the home page is unstable on purpose, so the stable read has something
//     real to settle;
//   - POST /__admin/deploy simulates a redeployment, so the gate can see the version under test
//     change underneath a running unit.

import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

export type TaskStatus = "open" | "done";

export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  /** ISO date, or null for a task with no due date. */
  due: string | null;
};

/** Five tasks, two of them without a due date (SCOPE.md, "The sample app"). */
function seedTasks(): Task[] {
  return [
    { id: 1, title: "Draft the release notes", status: "open", due: "2026-10-02" },
    { id: 2, title: "Review the onboarding copy", status: "open", due: "2026-10-05" },
    { id: 3, title: "Archive the old reports", status: "done", due: "2026-09-28" },
    { id: 4, title: "Plan the next retrospective", status: "open", due: null },
    { id: 5, title: "Tidy the shared inbox", status: "open", due: null },
  ];
}

/**
 * 12 hex characters, as the contract spells out for `build`. A deploy must report *a new* build id,
 * so a repeat of the current one is drawn again rather than handed out.
 */
function newBuildId(previous?: string): string {
  let id = randomBytes(6).toString("hex");
  while (id === previous) {
    id = randomBytes(6).toString("hex");
  }
  return id;
}

const tasks: Task[] = seedTasks();
let nextId = tasks.length + 1;

/**
 * The version under test. `POST /__admin/deploy` replaces both fields to simulate a redeployment,
 * so the gate can read the version before and after a unit and see whether it moved.
 */
const state = { version: "1.4.0", build: newBuildId() };

/** How long the today counter takes to reach its final value. Unstable on purpose. */
const COUNTER_RAMP_MS = 600;

const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

function openTasks(): Task[] {
  return tasks.filter((task) => task.status === "open");
}

// --- the collection, as the two `status` and `sort` parameters describe it -------------------------

/**
 * The contract defines `?status=open|done` and `?sort=due` and says nothing about any other value,
 * and no case in catalog/cases.csv covers one. Rather than invent a fourth behaviour, an
 * unrecognised value is simply not a filter and not a sort.
 */
function selectTasks(params: URLSearchParams): Task[] {
  const status = params.get("status");
  let selected = tasks;
  if (status === "open" || status === "done") {
    selected = selected.filter((task) => task.status === status);
  }
  if (params.get("sort") === "due") {
    selected = sortByDue(selected);
  }
  return [...selected];
}

/** By due date, with the tasks that have no due date **last** (SCOPE.md's route table). */
function sortByDue(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.due === null && b.due === null) return 0;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    if (a.due < b.due) return -1;
    return a.due > b.due ? 1 : 0;
  });
}

function findTask(raw: string): Task | undefined {
  const id = Number(raw);
  if (!Number.isInteger(id)) return undefined;
  return tasks.find((task) => task.id === id);
}

// --- responses ------------------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function sendHtml(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, main: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body>
<main>
${main}
</main>
${script}
</body>
</html>
`;
}

/** Read a JSON request body. `undefined` means the body was not valid JSON. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function asRecord(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  return body as Record<string, unknown>;
}

// --- pages ----------------------------------------------------------------------------------------

/**
 * The home page. The today counter climbs from 0 to the number of open tasks over about
 * COUNTER_RAMP_MS and renders every number on the way, so a reader that samples it once can read a
 * value that is true for a moment and wrong by the time it is asserted. It is the control the
 * stable read exists for.
 */
function homePage(): string {
  const target = openTasks().length;
  const stepMs = Math.round(COUNTER_RAMP_MS / Math.max(target, 1));
  const main = `<h1>Acme Tasks</h1>
<p>Open tasks today: <span data-testid="today-counter">0</span></p>
<ul>
<li><a href="/tasks">All tasks</a></li>
<li><a href="/settings/notifications">Notification settings</a></li>
</ul>`;
  const script = `<script>
(() => {
  const target = ${target};
  const stepMs = ${stepMs};
  const el = document.querySelector('[data-testid="today-counter"]');
  let shown = 0;
  el.textContent = '0';
  const tick = () => {
    shown += 1;
    el.textContent = String(shown);
    if (shown < target) setTimeout(tick, stepMs);
  };
  if (target > 0) setTimeout(tick, stepMs);
})();
</script>`;
  return page("Acme Tasks", main, script);
}

function dueText(task: Task): string {
  return task.due ?? "no due date";
}

function taskListPage(selected: Task[]): string {
  const rows = selected
    .map(
      (task) => `<li data-testid="task-row">
<a href="/tasks/${task.id}" data-testid="task-title">${escapeHtml(task.title)}</a>
<span data-testid="task-status">${task.status}</span>
<span data-testid="task-due">${escapeHtml(dueText(task))}</span>
</li>`,
    )
    .join("\n");
  const main = `<h1>Tasks</h1>
<ul data-testid="task-list">
${rows}
</ul>
<p><a href="/">Home</a></p>`;
  return page("Tasks — Acme Tasks", main);
}

function taskDetailPage(task: Task): string {
  const main = `<h1 data-testid="task-title">${escapeHtml(task.title)}</h1>
<p>Status: <span data-testid="task-status">${task.status}</span></p>
<p>Due: <span data-testid="task-due">${escapeHtml(dueText(task))}</span></p>
<p><a href="/tasks">All tasks</a></p>`;
  return page(`${escapeHtml(task.title)} — Acme Tasks`, main);
}

/**
 * The notification settings page. The button calls POST /api/notifications/test and shows what came
 * back. In this demo there is no mail transport, so what it shows is the failure — which is exactly
 * why the manual case for this screen is red here and declared rather than rewritten.
 */
function notificationsPage(): string {
  const main = `<h1>Notification settings</h1>
<p>Check that notification email reaches you.</p>
<button type="button" data-testid="send-test-email">Send a test email</button>
<p data-testid="test-email-result"></p>
<p><a href="/">Home</a></p>`;
  const script = `<script>
(() => {
  const button = document.querySelector('[data-testid="send-test-email"]');
  const result = document.querySelector('[data-testid="test-email-result"]');
  button.addEventListener('click', async () => {
    result.textContent = 'Sending…';
    let res;
    try {
      res = await fetch('/api/notifications/test', { method: 'POST' });
    } catch (err) {
      result.textContent = 'Could not send the test email: ' + err;
      return;
    }
    let body = {};
    try { body = await res.json(); } catch {}
    result.dataset.status = String(res.status);
    result.textContent = res.ok
      ? 'Test email sent'
      : 'Could not send the test email: ' + (body.error || res.status);
  });
})();
</script>`;
  return page("Notification settings — Acme Tasks", main, script);
}

function notFoundPage(): string {
  return page("Not found — Acme Tasks", "<h1>Not found</h1>\n<p>No page at this address.</p>");
}

// --- routing --------------------------------------------------------------------------------------

const TASK_PAGE = /^\/tasks\/([^/]+)$/;
const TASK_API = /^\/api\/tasks\/([^/]+)$/;

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const path = url.pathname;

  if (method === "GET" && path === "/") {
    sendHtml(res, 200, homePage());
    return;
  }
  if (method === "GET" && path === "/tasks") {
    sendHtml(res, 200, taskListPage(selectTasks(url.searchParams)));
    return;
  }
  if (method === "GET" && path === "/settings/notifications") {
    sendHtml(res, 200, notificationsPage());
    return;
  }
  if (method === "GET" && path === "/version") {
    sendJson(res, 200, { version: state.version, build: state.build });
    return;
  }
  if (method === "GET" && path === "/api/tasks") {
    sendJson(res, 200, selectTasks(url.searchParams));
    return;
  }

  const taskPage = method === "GET" ? TASK_PAGE.exec(path) : null;
  if (taskPage) {
    const task = findTask(taskPage[1]);
    if (!task) {
      sendHtml(res, 404, notFoundPage());
      return;
    }
    sendHtml(res, 200, taskDetailPage(task));
    return;
  }

  const taskApi = TASK_API.exec(path);
  if (taskApi && method === "GET") {
    const task = findTask(taskApi[1]);
    if (!task) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    sendJson(res, 200, task);
    return;
  }
  if (taskApi && method === "PATCH") {
    await patchTask(req, res, taskApi[1]);
    return;
  }

  if (method === "POST" && path === "/api/tasks") {
    await createTask(req, res);
    return;
  }
  if (method === "POST" && path === "/api/notifications/test") {
    // There is no mail transport in this demo. The contract says so, so 503 is the specified
    // behaviour of *this build* — and the UI case that expects the mail to be sent stays red.
    sendJson(res, 503, { error: "mail transport unavailable" });
    return;
  }
  if (method === "POST" && path === "/__admin/deploy") {
    await deploy(req, res);
    return;
  }

  if (path.startsWith("/api/") || path.startsWith("/__admin/")) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  sendHtml(res, 404, notFoundPage());
}

async function createTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = asRecord(await readJsonBody(req));
  if (!body) {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title === "") {
    sendJson(res, 400, { error: "title is required" });
    return;
  }
  const due = typeof body.due === "string" && body.due !== "" ? body.due : null;
  const status: TaskStatus = body.status === "done" ? "done" : "open";
  const task: Task = { id: nextId, title, status, due };
  nextId += 1;
  tasks.push(task);
  sendJson(res, 201, task);
}

async function patchTask(req: IncomingMessage, res: ServerResponse, raw: string): Promise<void> {
  const body = asRecord(await readJsonBody(req));
  if (!body) {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }
  const status = body.status;
  if (status !== "open" && status !== "done") {
    sendJson(res, 400, { error: "status must be open or done" });
    return;
  }
  const task = findTask(raw);
  if (!task) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  task.status = status;
  sendJson(res, 200, task);
}

/**
 * The simulated redeployment. From here on /version reports the new version and a new build id, so a
 * gate that read the version before a unit and reads it again afterwards sees that the thing it was
 * testing was replaced halfway through.
 */
async function deploy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = asRecord(await readJsonBody(req));
  if (!body) {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }
  const version = body.version;
  if (typeof version !== "string" || !SEMVER.test(version)) {
    sendJson(res, 400, { error: "version must be a semver" });
    return;
  }
  state.version = version;
  state.build = newBuildId(state.build);
  sendJson(res, 200, { version: state.version, build: state.build });
}

const port = Number(process.env.PORT ?? 18430);
const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    process.stderr.write(`unhandled request error: ${String(err)}\n`);
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    res.end();
  });
});

server.listen(port, () => {
  process.stdout.write(
    `Acme Tasks listening on http://localhost:${port} (version ${state.version})\n`,
  );
});

/** `pnpm app` is stopped with a signal; close the listener so the port is free straight away. */
function shutdown(): void {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
