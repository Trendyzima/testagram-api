export type JsonObject = Record<string, unknown>;

export interface TestagramApiOptions {
  /** Public Backend API origin, e.g. https://api.testagram.site */
  baseUrl: string;
  /** Appwrite session JWT for the currently signed-in user. */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class TestagramApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "TestagramApiError";
  }
}

export class TestagramApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: TestagramApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetcher = options.fetch ?? fetch;
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = true,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error("API path must be an absolute path on the configured API origin");
    }
    const headers = new Headers(this.options.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (authenticated) {
      const token = await this.options.getAccessToken?.();
      if (!token) throw new Error("An Appwrite session JWT is required for this operation");
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const raw = response.status === 204 ? "" : await response.text();
    let body: unknown = undefined;
    if (raw) {
      try { body = JSON.parse(raw) as unknown; }
      catch { body = raw; }
    }
    if (!response.ok) {
      const candidate = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const nestedError = candidate.error && typeof candidate.error === "object"
        ? candidate.error as Record<string, unknown>
        : undefined;
      const message = typeof nestedError?.message === "string"
        ? nestedError.message
        : typeof candidate.message === "string"
          ? candidate.message
          : typeof candidate.error === "string"
            ? candidate.error
            : `Testagram API request failed (${response.status})`;
      throw new TestagramApiError(message, response.status, body, requestId);
    }
    return body as T;
  }

  get<T>(path: string, authenticated = true): Promise<T> {
    return this.request<T>(path, { method: "GET" }, authenticated);
  }

  post<T>(path: string, payload?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  createPost<T = unknown>(input: {
    content: string;
    visibility: "public" | "followers" | "private";
    idempotencyKey: string;
  }): Promise<T> {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey)) {
      throw new Error("Idempotency-Key must contain 8-128 safe characters");
    }
    return this.request<T>("/api/social/posts", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        content: input.content,
        visibility: input.visibility,
      }),
    });
  }
}

export const endpoints = {
  homeFeed: "/api/feed/home",
  search: "/api/search",
  socialPosts: "/api/social/posts",
  follow: "/api/social/follows",
  notifications: "/api/social/notifications",
  threads: "/api/threads",
  postInteractionSummary: (postId: string) =>
    `/api/social/posts/${encodeURIComponent(postId)}/interaction-summary`,
  postReaction: (postId: string) =>
    `/api/social/posts/${encodeURIComponent(postId)}/reaction`,
  postReposts: (postId: string) =>
    `/api/social/posts/${encodeURIComponent(postId)}/reposts`,
  postBookmarks: (postId: string) =>
    `/api/social/posts/${encodeURIComponent(postId)}/bookmarks`,
  postReplies: (postId: string) =>
    `/api/social/posts/${encodeURIComponent(postId)}/replies`,
} as const;
