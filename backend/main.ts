import { Hono } from "npm:hono@4.8.3";
import { cors } from "npm:hono@4.8.3/cors";
import { MongoClient, ObjectId } from "npm:mongodb@6.17.0";

const MONGODB_URI = Deno.env.get("MONGODB_URI") || "";
const MONGODB_DB = Deno.env.get("MONGODB_DB") || "vision_center";
const PORT = Number(Deno.env.get("PORT") || 8000);
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const allowedCollections = new Set([
  "students",
  "attendance",
  "payments",
  "groups",
  "teachers",
  "exams",
  "homework",
  "whatsapp",
  "rooms",
  "expenses",
  "staff",
  "leads",
  "complaints",
]);

let clientPromise: Promise<MongoClient> | null = null;

function jsonError(c: any, message: string, status = 400) {
  return c.json({ ok: false, error: message }, status);
}

async function getDb() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Add it in .env locally and in Deno Deploy environment variables.");
  }
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      retryWrites: true,
    });
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db(MONGODB_DB);
}

function parseObjectId(id: string) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

function getCenterId(c: any) {
  return c.req.query("centerId") || "vision-main";
}

function cleanRecord(record: Record<string, unknown>) {
  const { _id, id, createdAt, updatedAt, centerId, type, ...rest } = record || {};
  return rest;
}

const app = new Hono();

app.use("*", cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.includes("*")) return origin || "*";
    return ALLOWED_ORIGINS.includes(origin) ? origin : "";
  },
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

app.get("/", (c) => c.json({ ok: true, app: "Vision Center Backend", docs: "/api/health" }));

app.get("/api/health", async (c) => {
  const db = await getDb();
  await db.command({ ping: 1 });
  return c.json({ ok: true, database: MONGODB_DB, time: new Date().toISOString() });
});

app.get("/api/state", async (c) => {
  const db = await getDb();
  const centerId = getCenterId(c);
  const doc = await db.collection("app_state").findOne({ centerId });
  return c.json({ ok: true, centerId, state: doc?.state || null, updatedAt: doc?.updatedAt || null });
});

app.put("/api/state", async (c) => {
  const db = await getDb();
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(c, "Invalid JSON body");
  const centerId = String(body.centerId || "vision-main").trim();
  if (!centerId) return jsonError(c, "centerId is required");
  if (!body.state || typeof body.state !== "object") return jsonError(c, "state object is required");
  const now = new Date();
  await db.collection("app_state").updateOne(
    { centerId },
    { $set: { centerId, state: body.state, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
  return c.json({ ok: true, centerId, updatedAt: now.toISOString() });
});

app.delete("/api/state", async (c) => {
  const db = await getDb();
  const centerId = getCenterId(c);
  const result = await db.collection("app_state").deleteOne({ centerId });
  return c.json({ ok: true, centerId, deletedCount: result.deletedCount });
});

app.get("/api/:collection", async (c) => {
  const collection = c.req.param("collection");
  if (!allowedCollections.has(collection)) return jsonError(c, "Collection is not allowed", 404);
  const db = await getDb();
  const centerId = getCenterId(c);
  const rows = await db.collection("records")
    .find({ centerId, type: collection })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(c.req.query("limit") || 500), 1000))
    .toArray();
  return c.json({ ok: true, centerId, collection, data: rows.map((r) => ({ id: String(r._id), ...r.payload, createdAt: r.createdAt, updatedAt: r.updatedAt })) });
});

app.post("/api/:collection", async (c) => {
  const collection = c.req.param("collection");
  if (!allowedCollections.has(collection)) return jsonError(c, "Collection is not allowed", 404);
  const db = await getDb();
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(c, "Invalid JSON body");
  const centerId = String(body.centerId || "vision-main").trim();
  const payload = cleanRecord(body.record || body);
  const now = new Date();
  const result = await db.collection("records").insertOne({ centerId, type: collection, payload, createdAt: now, updatedAt: now });
  return c.json({ ok: true, centerId, collection, data: { id: String(result.insertedId), ...payload, createdAt: now, updatedAt: now } }, 201);
});

app.get("/api/:collection/:id", async (c) => {
  const collection = c.req.param("collection");
  if (!allowedCollections.has(collection)) return jsonError(c, "Collection is not allowed", 404);
  const objectId = parseObjectId(c.req.param("id"));
  if (!objectId) return jsonError(c, "Invalid record id");
  const db = await getDb();
  const centerId = getCenterId(c);
  const doc = await db.collection("records").findOne({ _id: objectId, centerId, type: collection });
  if (!doc) return jsonError(c, "Record not found", 404);
  return c.json({ ok: true, centerId, collection, data: { id: String(doc._id), ...doc.payload, createdAt: doc.createdAt, updatedAt: doc.updatedAt } });
});

app.put("/api/:collection/:id", async (c) => {
  const collection = c.req.param("collection");
  if (!allowedCollections.has(collection)) return jsonError(c, "Collection is not allowed", 404);
  const objectId = parseObjectId(c.req.param("id"));
  if (!objectId) return jsonError(c, "Invalid record id");
  const db = await getDb();
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError(c, "Invalid JSON body");
  const centerId = String(body.centerId || c.req.query("centerId") || "vision-main").trim();
  const payload = cleanRecord(body.record || body);
  const now = new Date();
  const result = await db.collection("records").findOneAndUpdate(
    { _id: objectId, centerId, type: collection },
    { $set: { payload, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!result) return jsonError(c, "Record not found", 404);
  return c.json({ ok: true, centerId, collection, data: { id: String(result._id), ...result.payload, createdAt: result.createdAt, updatedAt: result.updatedAt } });
});

app.delete("/api/:collection/:id", async (c) => {
  const collection = c.req.param("collection");
  if (!allowedCollections.has(collection)) return jsonError(c, "Collection is not allowed", 404);
  const objectId = parseObjectId(c.req.param("id"));
  if (!objectId) return jsonError(c, "Invalid record id");
  const db = await getDb();
  const centerId = getCenterId(c);
  const result = await db.collection("records").deleteOne({ _id: objectId, centerId, type: collection });
  return c.json({ ok: true, centerId, collection, deletedCount: result.deletedCount });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ ok: false, error: err.message || "Internal server error" }, 500);
});

Deno.serve({ port: PORT }, app.fetch);
