const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, MKCOL, PROPFIND, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Depth, If-Match, If-None-Match",
  "Access-Control-Expose-Headers": "ETag, X-Remote-ETag",
  "Access-Control-Max-Age": "86400",
};

const ALLOWED_METHODS = new Set(["GET", "PUT", "MKCOL", "PROPFIND", "OPTIONS"]);
const DEFAULT_KEY = "/life-plan.json";

function withCors(headers = {}) {
  return { ...CORS_HEADERS, ...headers };
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: withCors({
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    }),
  });
}

function textResponse(text, status = 200, contentType = "application/json; charset=utf-8", headers = {}) {
  return new Response(text, {
    status,
    headers: withCors({
      "Content-Type": contentType,
      ...headers,
    }),
  });
}

function normalizeKey(pathname) {
  const decoded = decodeURIComponent(pathname || DEFAULT_KEY).trim();
  const normalized = decoded.startsWith("/") ? decoded : `/${decoded}`;
  return normalized === "/" ? DEFAULT_KEY : normalized;
}

function requireStorage(env) {
  if (!env.LIFE_PLAN_KV) {
    throw new Error("Missing KV binding: LIFE_PLAN_KV");
  }
  return env.LIFE_PLAN_KV;
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function createEtag(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `"${toHex(digest)}"`;
}

function normalizeEtag(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "*") return raw;
  return raw.startsWith('"') && raw.endsWith('"') ? raw : `"${raw.replace(/^W\//, "").replace(/^"|"$/g, "")}"`;
}

function getStoredEtag(value, metadata) {
  return normalizeEtag(metadata?.etag || metadata?.version || value?.metadata?.etag || "");
}

function etagHeaders(etag) {
  const normalized = normalizeEtag(etag);
  return normalized ? { ETag: normalized, "X-Remote-ETag": normalized } : {};
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (!ALLOWED_METHODS.has(request.method)) {
        return jsonResponse({ ok: false, error: `Unsupported method: ${request.method}` }, 405);
      }

      const url = new URL(request.url);

      if (url.pathname === "/" || url.pathname === "/__health") {
        return jsonResponse({
          ok: true,
          name: "life-plan-cloud-storage",
          storage: Boolean(env.LIFE_PLAN_KV),
          conditionalWrites: true,
          message: env.LIFE_PLAN_KV
            ? "Worker is ready. Data will be stored in Cloudflare KV."
            : "Please add a KV binding named LIFE_PLAN_KV.",
        });
      }

      if (url.pathname === "/__debug-storage") {
        const kv = requireStorage(env);
        const key = normalizeKey(url.searchParams.get("path") || DEFAULT_KEY);
        const value = await kv.getWithMetadata(key);
        const etag = value.value === null ? "" : getStoredEtag(value.value, value.metadata) || await createEtag(value.value);
        return jsonResponse({
          ok: true,
          key,
          exists: value.value !== null,
          etag: etag || null,
          metadata: value.metadata || null,
          bytes: value.value ? new TextEncoder().encode(value.value).length : 0,
        }, 200, etagHeaders(etag));
      }

      const kv = requireStorage(env);
      const key = normalizeKey(url.pathname);

      if (request.method === "PROPFIND") {
        const value = await kv.getWithMetadata(key);
        const etag = value.value === null ? "" : getStoredEtag(value.value, value.metadata) || await createEtag(value.value);
        return jsonResponse({
          ok: true,
          key,
          exists: value.value !== null,
          etag: etag || null,
          metadata: value.metadata || null,
        }, 207, etagHeaders(etag));
      }

      if (request.method === "MKCOL") {
        return jsonResponse({ ok: true, message: "Folder creation is not needed for KV storage." }, 201);
      }

      if (request.method === "GET") {
        const value = await kv.getWithMetadata(key);
        if (value.value === null) {
          return jsonResponse({ ok: false, error: "Not found", key }, 404);
        }
        const etag = getStoredEtag(value.value, value.metadata) || await createEtag(value.value);
        return textResponse(value.value, 200, "application/json; charset=utf-8", etagHeaders(etag));
      }

      if (request.method === "PUT") {
        const current = await kv.getWithMetadata(key);
        const currentEtag = current.value === null ? "" : getStoredEtag(current.value, current.metadata) || await createEtag(current.value);
        const ifMatch = normalizeEtag(request.headers.get("If-Match"));
        const ifNoneMatch = normalizeEtag(request.headers.get("If-None-Match"));

        if (ifMatch && ifMatch !== "*" && ifMatch !== currentEtag) {
          return jsonResponse({
            ok: false,
            error: "Precondition failed",
            key,
            etag: currentEtag || null,
          }, 412, etagHeaders(currentEtag));
        }

        if (ifNoneMatch === "*" && current.value !== null) {
          return jsonResponse({
            ok: false,
            error: "Already exists",
            key,
            etag: currentEtag || null,
          }, 412, etagHeaders(currentEtag));
        }

        const body = await request.text();
        const etag = await createEtag(body);
        const savedAt = new Date().toISOString();
        await kv.put(key, body, {
          metadata: {
            updatedAt: savedAt,
            bytes: new TextEncoder().encode(body).length,
            etag,
          },
        });
        return jsonResponse({ ok: true, key, etag, savedAt }, 200, etagHeaders(etag));
      }

      return jsonResponse({ ok: false, error: `Unhandled method: ${request.method}` }, 405);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: "Worker storage failed",
          detail: String(error && error.message ? error.message : error),
        },
        500
      );
    }
  },
};
