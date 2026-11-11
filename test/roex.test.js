const { test, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_ANON_KEY = "test-public-key";
process.env.ROEX_API_KEY = "test-roex-key";
process.env.OPENAI_API_KEY = "test-openai-key";

const app = require("../server");
const originalFetch = global.fetch;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function invokeRoute(routePath, { headers = {}, body = {}, file } = {}) {
  const layer = app._router.stack.find(item => item.route?.path === routePath && item.route.methods.post);
  assert.ok(layer, `POST ${routePath} route exists`);
  const req = { headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])), body, file };
  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  const handlers = layer.route.stack.map(item => item.handle);
  async function run(index) {
    if (index >= handlers.length) return;
    const handler = handlers[index];
    if (handler.name === "multerMiddleware") return run(index + 1);
    let nextPromise;
    const next = error => {
      if (error) throw error;
      nextPromise = run(index + 1);
      return nextPromise;
    };
    await handler(req, res, next);
    if (nextPromise) await nextPromise;
  }
  await run(0);
  return { status: res.statusCode, body: res.payload };
}

test("RoEx preview and retrieval routes keep task ID and use authenticated calls", async () => {
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url) === "https://supabase.test/auth/v1/user") {
      return json(200, { id: "test-user" });
    }
    if (String(url) === "https://tonn.roexaudio.com/upload") {
      return json(200, { signed_url: "https://upload.test/signed?token=secret", readable_url: "https://audio.test/file" });
    }
    if (String(url).startsWith("https://upload.test/")) return new Response(null, { status: 200 });
    if (String(url) === "https://tonn.roexaudio.com/mixenhancepreview") {
      return json(200, { mixrevive_task_id: "mix-task-test" });
    }
    if (String(url) === "https://tonn.roexaudio.com/retrieveenhancedtrack") {
      return json(200, { revived_track_tasks_results: { download_url_preview_revived: "https://audio.test/preview" } });
    }
    if (String(url) === "https://tonn.roexaudio.com/masteringpreview") {
      return json(200, { mastering_task_id: "master-task-test" });
    }
    if (String(url) === "https://tonn.roexaudio.com/retrievepreviewmaster") {
      return json(200, { previewMasterTaskResults: { download_url_mastered_preview: "https://audio.test/master-preview" } });
    }
    throw new Error(`Unexpected mocked request: ${url}`);
  };

  const auth = { Authorization: "Bearer test-access-token" };
  const form = () => {
    const body = new FormData();
    body.append("audio", new Blob(["fake audio bytes"], { type: "audio/mpeg" }), "test.mp3");
    body.append("musicalStyle", "POP");
    return body;
  };

  const mix = await invokeRoute("/api/roex/preview", { headers: auth, body: {}, file: { originalname: "test.mp3", mimetype: "audio/mpeg", buffer: Buffer.from("fake audio bytes") } });
  const mixBody = mix.body;
  assert.equal(mix.status, 200);
  assert.equal(mixBody.taskId, "mix-task-test");

  const mixResult = await invokeRoute("/api/roex/preview-result", { headers: auth, body: { taskId: mixBody.taskId } });
  assert.equal(mixResult.status, 200);
  assert.equal(mixResult.body.previewUrl, "https://audio.test/preview");

  const master = await invokeRoute("/api/roex/mastering-preview", { headers: auth, file: { originalname: "test.mp3", mimetype: "audio/mpeg", buffer: Buffer.from("fake audio bytes") } });
  const masterBody = master.body;
  assert.equal(master.status, 200);
  assert.equal(masterBody.taskId, "master-task-test");

  const masterResult = await invokeRoute("/api/roex/mastering-preview-result", { headers: auth, body: { taskId: masterBody.taskId } });
  assert.equal(masterResult.status, 200);
  assert.equal(masterResult.body.previewUrl, "https://audio.test/master-preview");

  const finalWithoutConfirmation = await invokeRoute("/api/roex/mastering-final", { headers: auth, body: { taskId: masterBody.taskId } });
  assert.equal(finalWithoutConfirmation.status, 400);
  assert.equal(requests.some(r => r.url.endsWith("/retrievefinalmaster")), false);

  const roexRequests = requests.filter(r => r.url.startsWith("https://tonn.roexaudio.com/") && !r.url.endsWith("/upload"));
  assert.ok(roexRequests.every(r => r.options.headers?.["X-API-Key"] === "test-roex-key"));
  const retrieve = roexRequests.find(r => r.url.endsWith("/retrieveenhancedtrack"));
  assert.ok(retrieve);
  assert.deepEqual(JSON.parse(retrieve.options.body).mixReviveData, { mixReviveTaskId: "mix-task-test" });
});

test("unauthenticated audio upload is rejected before any RoEx call", async () => {
  let roexCalled = false;
  global.fetch = async (url, options = {}) => {
    if (String(url) === "https://supabase.test/auth/v1/user") return json(401, {});
    if (String(url).startsWith("https://tonn.roexaudio.com/")) roexCalled = true;
    return json(500, {});
  };
  const response = await invokeRoute("/api/roex/preview", { file: { originalname: "test.mp3", mimetype: "audio/mpeg", buffer: Buffer.from("fake") } });
  assert.equal(response.status, 401);
  assert.equal(roexCalled, false);
});

test("paid full-master retrieval requires confirmation and cannot be repeated", async () => {
  const requests = [];
  global.fetch = async (url, options = {}) => {
    if (String(url) === "https://supabase.test/auth/v1/user") return json(200, { id: "test-user" });
    if (String(url).startsWith("https://supabase.test/rest/v1/projects?")) return json(200, [{ metadata: { mastering: { taskId: "final-task-test" } } }]);
    requests.push({ url: String(url), options });
    if (String(url) === "https://tonn.roexaudio.com/retrievefinalmaster") {
      return json(200, { finalMasterTaskResults: "https://audio.test/final-master" });
    }
    throw new Error(`Unexpected mocked request: ${url}`);
  };
  const options = { headers: { Authorization: "Bearer test-access-token" }, body: { taskId: "final-task-test", projectId: "project-test", confirmedCreditCharge: true } };
  const first = await invokeRoute("/api/roex/mastering-final", options);
  assert.equal(first.status, 200);
  assert.equal(first.body.masterUrl, "https://audio.test/final-master");
  const duplicate = await invokeRoute("/api/roex/mastering-final", options);
  assert.equal(duplicate.status, 200);
  assert.equal(requests.filter(r => r.url.endsWith("/retrievefinalmaster")).length, 1);
});

test("paid master retrieval rejects a task that is not attached to the user's project", async () => {
  let roexCalled = false;
  global.fetch = async (url) => {
    if (String(url) === "https://supabase.test/auth/v1/user") return json(200, { id: "test-user" });
    if (String(url).startsWith("https://supabase.test/rest/v1/projects?")) return json(200, [{ metadata: { mastering: { taskId: "another-task" } } }]);
    if (String(url).startsWith("https://tonn.roexaudio.com/")) roexCalled = true;
    throw new Error(`Unexpected mocked request: ${url}`);
  };
  const response = await invokeRoute("/api/roex/mastering-final", {
    headers: { Authorization: "Bearer test-access-token" },
    body: { taskId: "foreign-task", projectId: "project-test", confirmedCreditCharge: true }
  });
  assert.equal(response.status, 403);
  assert.equal(roexCalled, false);
});

test("full Mix Enhance is gated by confirmation and returns the full track URL", async () => {
  const requests = [];
  global.fetch = async (url, options = {}) => {
    if (String(url) === "https://supabase.test/auth/v1/user") return json(200, { id: "test-user" });
    if (String(url).startsWith("https://supabase.test/rest/v1/projects?")) return json(200, [{ metadata: { mixEnhance: { taskId: "full-mix-task-test" } } }]);
    requests.push({ url: String(url), options });
    if (String(url) === "https://tonn.roexaudio.com/upload") return json(200, { signed_url: "https://upload.test/signed?token=not-logged", readable_url: "https://audio.test/input" });
    if (String(url).startsWith("https://upload.test/")) return new Response(null, { status: 200 });
    if (String(url) === "https://tonn.roexaudio.com/mixenhance") return json(200, { mixrevive_task_id: "full-mix-task-test" });
    if (String(url) === "https://tonn.roexaudio.com/retrieveenhancedtrack") return json(200, { revived_track_tasks_results: { download_url_revived: "https://audio.test/full-mix" } });
    throw new Error(`Unexpected mocked request: ${url}`);
  };
  const auth = { Authorization: "Bearer test-access-token" };
  const file = { originalname: "full.mp3", mimetype: "audio/mpeg", buffer: Buffer.from("test") };
  const denied = await invokeRoute("/api/roex/enhance-final", { headers: auth, body: {}, file });
  assert.equal(denied.status, 400);
  assert.equal(requests.length, 0);
  const started = await invokeRoute("/api/roex/enhance-final", { headers: auth, body: { confirmedCreditCharge: "true", musicalStyle: "POP", projectId: "project-test" }, file });
  assert.equal(started.status, 200);
  assert.equal(started.body.taskId, "full-mix-task-test");
  const result = await invokeRoute("/api/roex/enhance-result", { headers: auth, body: { taskId: started.body.taskId, projectId: "project-test", confirmedCreditCharge: true } });
  assert.equal(result.status, 200);
  assert.equal(result.body.masterUrl, "https://audio.test/full-mix");
  assert.ok(requests.some(r => r.url.endsWith("/mixenhance")));
  assert.ok(requests.some(r => r.url.endsWith("/retrieveenhancedtrack")));
});

test("assistant honors English language setting without sending real provider traffic", async () => {
  let providerRequest;
  global.fetch = async (url, options = {}) => {
    if (String(url) === "https://supabase.test/auth/v1/user") return json(200, { id: "test-user" });
    if (String(url) === "https://api.openai.com/v1/responses") {
      providerRequest = JSON.parse(options.body);
      return json(200, { output: [{ content: [{ type: "output_text", text: "Use a gentle high-pass filter." }] }] });
    }
    throw new Error(`Unexpected mocked request: ${url}`);
  };
  const response = await invokeRoute("/api/assistant", { headers: { Authorization: "Bearer test-access-token" }, body: { message: "How can I reduce rumble?", language: "en" } });
  assert.equal(response.status, 200);
  assert.match(providerRequest.instructions, /Respond in clear, friendly, professional English/);
  assert.equal(response.body.message, "Use a gentle high-pass filter.");
});

after(() => {
  global.fetch = originalFetch;
});
