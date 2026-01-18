import { env } from "@circular-music/env/web";
import {
  convexClient,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { anonymousClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient(), crossDomainClient()],
});
