// Serves the static site.
// Sends www, any other non-canonical host and any plain-http request to https://advaasthavishwakarma.in
// with a 301. Search Console was showing http:// copies of pages alongside the https:// ones,
// which splits each page's ranking signals.
const CANONICAL = "advaasthavishwakarma.in";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".workers.dev");
    if (!isLocal && (url.hostname !== CANONICAL || url.protocol === "http:")) {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  }
};
