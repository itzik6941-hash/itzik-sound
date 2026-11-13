const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.MAINTENANCE_MODE = "true";
process.env.MAINTENANCE_ADMIN_CODE = "test-only-admin-code";
process.env.ADMIN_SESSION_SECRET = "test-only-session-secret-at-least-32-characters";

const app = require("../server");

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    file: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    sendFile(value) { this.file = value; return this; }
  };
}

function route(path, method) {
  const layer = app._router.stack.find(item => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} exists`);
  return layer.route.stack[0].handle;
}

async function runGate({ path = "/", method = "GET", cookie = "" } = {}) {
  const req = { path, method, headers: { cookie }, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } };
  const res = response();
  let nextCalled = false;
  await app.locals.maintenanceGate(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

async function login(code, ip = "127.0.0.2") {
  const req = { body: { code }, headers: {}, ip, socket: { remoteAddress: ip } };
  const res = response();
  await route("/api/admin/login", "post")(req, res);
  return res;
}

test("maintenance blocks app pages, assets, and private API for visitors", async () => {
  const root = await runGate({ path: "/" });
  assert.equal(root.nextCalled, false);
  assert.equal(root.res.statusCode, 503);
  assert.match(root.res.file, /maintenance\.html$/);

  const direct = await runGate({ path: "/projects" });
  assert.equal(direct.nextCalled, false);
  assert.match(direct.res.file, /maintenance\.html$/);

  const api = await runGate({ path: "/api/projects" });
  assert.equal(api.nextCalled, false);
  assert.equal(api.res.statusCode, 503);
  assert.equal(api.res.body.error, "MAINTENANCE_MODE");

  const config = await runGate({ path: "/config.js" });
  assert.equal(config.nextCalled, false);
});

test("admin login issues a secure session that survives navigation and logout revokes it", async () => {
  const invalid = await login("wrong-code", "127.0.0.3");
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.headers["set-cookie"], undefined);

  const accepted = await login("test-only-admin-code", "127.0.0.4");
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.ok, true);
  const setCookie = accepted.headers["set-cookie"];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.doesNotMatch(setCookie, /test-only-admin-code/);
  const cookie = setCookie.split(";")[0];

  const root = await runGate({ path: "/", cookie });
  assert.equal(root.nextCalled, true);
  const api = await runGate({ path: "/api/projects", cookie });
  assert.equal(api.nextCalled, true);

  const logoutReq = { headers: { cookie }, body: {} };
  const logoutRes = response();
  await route("/api/admin/logout", "post")(logoutReq, logoutRes);
  assert.equal(logoutRes.body.ok, true);
  assert.match(logoutRes.headers["set-cookie"], /Max-Age=0/);

  const afterLogout = await runGate({ path: "/", cookie });
  assert.equal(afterLogout.nextCalled, false);
});

test("admin login rate limit blocks guesses after five attempts", async () => {
  const ip = "127.0.0.5";
  for (let i = 0; i < 5; i++) assert.equal((await login("bad", ip)).statusCode, 401);
  const limited = await login("test-only-admin-code", ip);
  assert.equal(limited.statusCode, 429);
  assert.ok(Number(limited.headers["retry-after"]) > 0);
});

test("invalid session cookies and weak secrets cannot access private routes", async () => {
  const tampered = await runGate({ path: "/api/projects", cookie: "itzik_admin_session=not-a-valid-signature" });
  assert.equal(tampered.nextCalled, false);
  assert.equal(tampered.res.statusCode, 503);

  process.env.ADMIN_SESSION_SECRET = "short";
  const weakSecret = await login("test-only-admin-code", "127.0.0.6");
  assert.equal(weakSecret.statusCode, 503);
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret-at-least-32-characters";
});

test("maintenance gate can be disabled to restore normal route access", async () => {
  process.env.MAINTENANCE_MODE = "false";
  const normalMode = await runGate({ path: "/" });
  assert.equal(normalMode.nextCalled, true);
  process.env.MAINTENANCE_MODE = "true";
});
