const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_ANON_KEY = "test-public-key";
process.env.ROEX_API_KEY = "test-roex-key";

const app = require("../server");
const server = http.createServer(app);
let baseUrl;
const originalFetch = global.fetch;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("RoEx preview and retrieval routes keep task ID and use authenticated calls", async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const requests = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).startsWith(baseUrl)) return originalFetch(url, options);
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

  const mix = await fetch(`${baseUrl}/api/roex/preview`, { method: "POST", headers: auth, body: form() });
  const mixBody = await mix.json();
  assert.equal(mix.status, 200);
  assert.equal(mixBody.taskId, "mix-task-test");

  const mixResult = await fetch(`${baseUrl}/api/roex/preview-result`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: mixBody.taskId })
  });
  assert.equal(mixResult.status, 200);
  assert.equal((await mixResult.json()).previewUrl, "https://audio.test/preview");

  const master = await fetch(`${baseUrl}/api/roex/mastering-preview`, { method: "POST", headers: auth, body: form() });
  const masterBody = await master.json();
  assert.equal(master.status, 200);
  assert.equal(masterBody.taskId, "master-task-test");

  const masterResult = await fetch(`${baseUrl}/api/roex/mastering-preview-result`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: masterBody.taskId })
  });
  assert.equal(masterResult.status, 200);
  assert.equal((await masterResult.json()).previewUrl, "https://audio.test/master-preview");

  const finalWithoutConfirmation = await fetch(`${baseUrl}/api/roex/mastering-final`, {
    method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: masterBody.taskId })
  });
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
    if (String(url).startsWith(baseUrl)) return originalFetch(url, options);
    if (String(url) === "https://supabase.test/auth/v1/user") return json(401, {});
    if (String(url).startsWith("https://tonn.roexaudio.com/")) roexCalled = true;
    return json(500, {});
  };
  const body = new FormData();
  body.append("audio", new Blob(["fake"], { type: "audio/mpeg" }), "test.mp3");
  const response = await fetch(`${baseUrl}/api/roex/preview`, { method: "POST", body });
  assert.equal(response.status, 401);
  assert.equal(roexCalled, false);
});

after(() => {
  global.fetch = originalFetch;
  if (server.listening) server.close();
});
