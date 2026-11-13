import { handleStagingTestRoute } from "./test-overlay.mjs";

export default {
  async fetch(request, env) {
    return (await handleStagingTestRoute(request, env)) || new Response("Not found", { status: 404 });
  },
};
