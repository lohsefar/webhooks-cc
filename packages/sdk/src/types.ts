export interface Endpoint {
  id: string;
  slug: string;
  name?: string;
  url: string;
  createdAt: number;
}

export interface Request {
  id: string;
  endpointId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryParams: Record<string, string>;
  contentType?: string;
  ip: string;
  size: number;
  receivedAt: number;
}

export interface CreateEndpointOptions {
  name?: string;
  mockResponse?: {
    status: number;
    body: string;
    headers?: Record<string, string>;
  };
}

export interface ListRequestsOptions {
  limit?: number;
  since?: number;
}

export interface WaitForOptions {
  timeout?: number;
  pollInterval?: number;
  match?: (request: Request) => boolean;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
}
