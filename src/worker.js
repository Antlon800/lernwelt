/**
 * Lernwelt – Cloudflare Worker entry point.
 * Static files are served through the ASSETS binding.
 * API endpoints will be added here as the authentication and learning modules
 * are implemented. Never put secrets in this file or in the public repository.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        app: "Lernwelt",
        databaseConfigured: Boolean(env.DB)
      }, {
        headers: {
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "same-origin"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "Dieser API-Endpunkt ist noch nicht eingerichtet." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};