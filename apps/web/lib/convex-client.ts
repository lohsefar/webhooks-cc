import { ConvexHttpClient } from "convex/browser";
import { publicEnv } from "./env";

let _client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!_client) {
    _client = new ConvexHttpClient(publicEnv().NEXT_PUBLIC_CONVEX_URL);
  }
  return _client;
}
