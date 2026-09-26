// Serves the static site. Sends www and any other non-canonical host to the canonical domain with a 301.
const CANONICAL = "advaasthavishwakarma.in";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "www." + CANONICAL) {
      url.hostname = CANONICAL;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  }
};
