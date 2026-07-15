import { z } from "zod";

const MAX_REQUEST_BYTES = 64 * 1024;
const RATE_LIMIT_SECONDS = 60;
const TURNSTILE_TIMEOUT_MS = 5_000;

type WorkerEnv = Env & { TURNSTILE_SECRET_KEY: string };

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  subject: z.string().trim().min(1).max(140),
  message: z.string().trim().min(10).max(5_000),
  website: z.string().max(0),
  turnstileToken: z.string().min(1).max(2_048),
});

type ContactSubmission = z.infer<typeof contactSchema>;
type RateLimitBinding =
  WorkerEnv["IP_RATE_LIMITER"] | WorkerEnv["EMAIL_RATE_LIMITER"];

interface TurnstileResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
}

interface LogEvent {
  event: string;
  requestId: string;
  outcome: "accepted" | "rejected" | "error";
  reason?: string;
  status: number;
}

function json(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "content-security-policy":
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      "permissions-policy":
        "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
      "referrer-policy": "no-referrer",
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}

function log(event: LogEvent): void {
  console.log(JSON.stringify(event));
}

function reject(
  requestId: string,
  status: number,
  message: string,
  reason: string,
): Response {
  log({
    event: "contact_submission",
    requestId,
    outcome: "rejected",
    reason,
    status,
  });
  return json({ ok: false, message }, status);
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function originIsAllowed(request: Request, env: WorkerEnv): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const requestOrigin = new URL(request.url).origin;
  return (
    origin === requestOrigin || splitList(env.ALLOWED_ORIGINS).includes(origin)
  );
}

async function isRateLimited(
  binding: RateLimitBinding,
  key: string,
  env: WorkerEnv,
  requestId: string,
): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    const result = await binding.limit({ key });
    return result.success ? "allowed" : "limited";
  } catch (error) {
    log({
      event: "rate_limit_check",
      requestId,
      outcome: "error",
      reason: error instanceof Error ? error.name : "unknown",
      status: 503,
    });
    return String(env.RATE_LIMIT_FAILURE_POLICY) === "open"
      ? "allowed"
      : "unavailable";
  }
}

async function parseBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new Error("request_too_large");
  }

  if (!request.body) throw new Error("invalid_json");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

async function verifyTurnstile(
  submission: ContactSubmission,
  request: Request,
  env: WorkerEnv,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);

  try {
    const body = new FormData();
    body.set("secret", env.TURNSTILE_SECRET_KEY);
    body.set("response", submission.turnstileToken);
    body.set("idempotency_key", crypto.randomUUID());

    const ip = request.headers.get("cf-connecting-ip");
    if (ip) body.set("remoteip", ip);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: controller.signal,
      },
    );

    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResult;
    const hostnames = splitList(env.TURNSTILE_HOSTNAMES);

    if (
      env.TURNSTILE_TEST_MODE === "true" &&
      result.success === true &&
      result.metadata?.result_with_testing_key === true
    ) {
      return true;
    }

    return (
      result.success === true &&
      result.action === "contact" &&
      typeof result.hostname === "string" &&
      hostnames.includes(result.hostname)
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

async function sendContactEmail(
  submission: ContactSubmission,
  env: WorkerEnv,
): Promise<void> {
  const subject = cleanHeader(submission.subject);
  const name = cleanHeader(submission.name);
  const message = escapeHtml(submission.message).replaceAll("\n", "<br />");

  await env.EMAIL.send({
    to: env.EMAIL_TO,
    from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME },
    replyTo: submission.email,
    subject: `[Website] ${subject}`,
    text: `Name: ${name}\nEmail: ${submission.email}\n\n${submission.message}`,
    html: `<h1>New website message</h1><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(submission.email)}</p><p><strong>Subject:</strong> ${escapeHtml(subject)}</p><p>${message}</p>`,
  });
}

async function handleContact(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const requestId = crypto.randomUUID();

  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed." }, 405, {
      Allow: "POST",
    });
  }

  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    "application/json"
  ) {
    return reject(
      requestId,
      415,
      "Content-Type must be application/json.",
      "invalid_content_type",
    );
  }

  if (!originIsAllowed(request, env)) {
    return reject(
      requestId,
      403,
      "Request origin is not allowed.",
      "invalid_origin",
    );
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipRateLimit = await isRateLimited(
    env.IP_RATE_LIMITER,
    `contact:ip:${ip}`,
    env,
    requestId,
  );
  if (ipRateLimit === "limited") {
    const response = reject(
      requestId,
      429,
      "Too many requests. Please retry later.",
      "ip_rate_limit",
    );
    response.headers.set("Retry-After", String(RATE_LIMIT_SECONDS));
    return response;
  }
  if (ipRateLimit === "unavailable") {
    return reject(
      requestId,
      503,
      "Form protection is temporarily unavailable.",
      "rate_limit_unavailable",
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await parseBody(request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid_body";
    return reject(
      requestId,
      reason === "request_too_large" ? 413 : 400,
      reason === "request_too_large"
        ? "Request is too large."
        : "Invalid JSON body.",
      reason,
    );
  }

  const parsed = contactSchema.safeParse(rawBody);
  if (!parsed.success) {
    const honeypotTriggered =
      typeof rawBody === "object" &&
      rawBody !== null &&
      "website" in rawBody &&
      typeof rawBody.website === "string" &&
      rawBody.website.length > 0;
    return reject(
      requestId,
      honeypotTriggered ? 200 : 400,
      honeypotTriggered
        ? "Message received."
        : "Please check the submitted fields.",
      honeypotTriggered ? "honeypot" : "validation",
    );
  }

  const emailRateLimit = await isRateLimited(
    env.EMAIL_RATE_LIMITER,
    `contact:email:${parsed.data.email}`,
    env,
    requestId,
  );
  if (emailRateLimit === "limited") {
    const response = reject(
      requestId,
      429,
      "Too many requests. Please retry later.",
      "email_rate_limit",
    );
    response.headers.set("Retry-After", String(RATE_LIMIT_SECONDS));
    return response;
  }
  if (emailRateLimit === "unavailable") {
    return reject(
      requestId,
      503,
      "Form protection is temporarily unavailable.",
      "rate_limit_unavailable",
    );
  }

  if (!(await verifyTurnstile(parsed.data, request, env))) {
    return reject(
      requestId,
      400,
      "Human verification failed. Please try again.",
      "turnstile",
    );
  }

  try {
    await sendContactEmail(parsed.data, env);
  } catch (error) {
    log({
      event: "contact_submission",
      requestId,
      outcome: "error",
      reason: error instanceof Error ? error.name : "email_send",
      status: 502,
    });
    return json(
      { ok: false, message: "The message could not be delivered." },
      502,
    );
  }

  log({
    event: "contact_submission",
    requestId,
    outcome: "accepted",
    status: 200,
  });
  return json({ ok: true, message: "Message sent. Thank you." });
}

export default {
  async fetch(request, env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (pathname === "/api/health") {
      return request.method === "GET"
        ? json({ ok: true, environment: env.ENVIRONMENT })
        : json({ ok: false, message: "Method not allowed." }, 405, {
            Allow: "GET",
          });
    }

    if (pathname === "/api/contact") return handleContact(request, env);
    if (pathname.startsWith("/api/"))
      return json({ ok: false, message: "Not found." }, 404);

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<WorkerEnv>;
