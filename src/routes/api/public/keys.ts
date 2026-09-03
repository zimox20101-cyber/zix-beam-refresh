import { createFileRoute } from "@tanstack/react-router"

const DURATIONS: Record<string, { label: string; ms: number | null }> = {
  "1d": { label: "1 Day", ms: 24 * 60 * 60 * 1000 },
  "1w": { label: "1 Week", ms: 7 * 24 * 60 * 60 * 1000 },
  "lifetime": { label: "Lifetime", ms: null },
}

function randChunk() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function generateKey() {
  return `ZIX-${randChunk()}-${randChunk()}-${randChunk()}`
}

const cooldowns = new Map<string, number>()
const COOLDOWN_MS = 10 * 60 * 1000

function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

function corsHeaders(origin?: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

export const Route = createFileRoute("/api/public/keys")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(request.headers.get("Origin") || undefined),
        })
      },

      POST: async ({ request }) => {
        const headers = corsHeaders(request.headers.get("Origin") || undefined)
        let body: Record<string, unknown>
        try {
          body = (await request.json()) as Record<string, unknown>
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          })
        }

        const durKey = typeof body.duration === "string" ? body.duration : ""
        const dur = DURATIONS[durKey]
        if (!dur) {
          return new Response(JSON.stringify({ error: "Invalid duration" }), {
            status: 400,
            headers: { ...headers, "Content-Type": "application/json" },
          })
        }

        const ip = getClientIp(request)
        const last = cooldowns.get(ip) || 0
        const now = Date.now()
        const remaining = last + COOLDOWN_MS - now
        if (remaining > 0) {
          return new Response(
            JSON.stringify({
              error: "Cooldown",
              retryAfter: Math.ceil(remaining / 1000),
            }),
            {
              status: 429,
              headers: {
                ...headers,
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil(remaining / 1000)),
              },
            }
          )
        }

        const keys = Array.from({ length: 2 }, generateKey)
        const expiresAt = dur.ms === null ? null : now + dur.ms
        const expiresLabel =
          expiresAt === null ? "never" : new Date(expiresAt).toISOString()

        const webhookUrl = process.env["KEYS_WEBHOOK_URL"]
        if (!webhookUrl) {
          return new Response(
            JSON.stringify({ error: "Server misconfiguration" }),
            {
              status: 500,
              headers: { ...headers, "Content-Type": "application/json" },
            }
          )
        }

        const msg =
          `**Zix Beam Tools — Key Request**\n` +
          `Duration: **${dur.label}**\n` +
          `Expires: ${expiresLabel}\n` +
          `IP: ${ip}\n` +
          `Keys:\n` +
          keys.map((k) => `\`${k}\``).join("\n")

        try {
          const whRes = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: msg,
              username: "Zix Beam Tools",
            }),
          })
          if (!whRes.ok) {
            const text = await whRes.text().catch(() => "")
            throw new Error(`Discord HTTP ${whRes.status}: ${text.slice(0, 120)}`)
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          return new Response(
            JSON.stringify({ error: "Webhook failed", detail: message }),
            {
              status: 502,
              headers: { ...headers, "Content-Type": "application/json" },
            }
          )
        }

        cooldowns.set(ip, now)

        return new Response(
          JSON.stringify({
            ok: true,
            keys,
            label: dur.label,
            expiresAt,
          }),
          {
            status: 200,
            headers: { ...headers, "Content-Type": "application/json" },
          }
        )
      },
    },
  },
})
