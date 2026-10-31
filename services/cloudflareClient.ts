/**
 * Supabase-shaped compatibility adapter backed only by same-origin Cloudflare
 * Worker endpoints. This lets the existing UI migrate screen-by-screen without
 * shipping any Supabase SDK, URL, or key to the browser.
 */

type D1Error = { message: string; code?: string; status?: number };
type D1Result<T = unknown> = { data: T | null; error: D1Error | null; count?: number };

type Filter = { field: string; op: string; value: unknown };
type Order = { field: string; ascending: boolean };

function appApiBase(): string {
  const configured = (import.meta as any).env?.VITE_CLOUDFLARE_API_URL || "";
  return String(configured).replace(/\/$/, "");
}

async function apiRequest<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; body: T }> {
  const base = appApiBase();
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({})) as T;
  return { response, body };
}

function normalizeError(body: any, status: number): D1Error | null {
  if (status >= 200 && status < 300 && body?.success !== false) return null;
  return {
    message: String(body?.error || body?.message || `Cloudflare API request failed (${status})`),
    code: String(body?.code || ""),
    status
  };
}

class D1QueryBuilder implements PromiseLike<D1Result> {
  private operation: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private columns = "*";
  private payload: any = null;
  private filters: Filter[] = [];
  private orGroups: Filter[][] = [];
  private orders: Order[] = [];
  private pageLimit: number | null = null;
  private pageOffset = 0;
  private singleMode: "single" | "maybeSingle" | null = null;
  private countMode: string | null = null;
  private upsertEnabled = false;

  constructor(private readonly table: string) {}

  select(columns = "*", _options?: unknown): this {
    this.columns = String(columns || "*");
    return this;
  }
  insert(payload: unknown): this { this.operation = "insert"; this.payload = payload; return this; }
  upsert(payload: unknown, _options?: unknown): this {
    this.operation = "upsert"; this.payload = payload; this.upsertEnabled = true; return this;
  }
  update(payload: unknown): this { this.operation = "update"; this.payload = payload; return this; }
  delete(): this { this.operation = "delete"; return this; }

  eq(field: string, value: unknown): this { this.filters.push({ field, op: "eq", value }); return this; }
  neq(field: string, value: unknown): this { this.filters.push({ field, op: "neq", value }); return this; }
  gt(field: string, value: unknown): this { this.filters.push({ field, op: "gt", value }); return this; }
  gte(field: string, value: unknown): this { this.filters.push({ field, op: "gte", value }); return this; }
  lt(field: string, value: unknown): this { this.filters.push({ field, op: "lt", value }); return this; }
  lte(field: string, value: unknown): this { this.filters.push({ field, op: "lte", value }); return this; }
  like(field: string, value: unknown): this { this.filters.push({ field, op: "like", value }); return this; }
  ilike(field: string, value: unknown): this { this.filters.push({ field, op: "ilike", value }); return this; }
  is(field: string, value: unknown): this { this.filters.push({ field, op: "is", value }); return this; }
  in(field: string, values: unknown[]): this { this.filters.push({ field, op: "in", value: values }); return this; }
  not(field: string, op: string, value: unknown): this {
    this.filters.push({ field, op: op === "is" ? "neq" : op === "eq" ? "neq" : op, value });
    return this;
  }
  match(values: Record<string, unknown>): this {
    for (const [field, value] of Object.entries(values || {})) this.eq(field, value);
    return this;
  }
  filter(field: string, op: string, value: unknown): this {
    this.filters.push({ field, op, value });
    return this;
  }
  or(expression: string): this {
    const parsed: Filter[] = [];
    const cleaned = String(expression || "").replace(/^\(|\)$/g, "");
    for (const term of cleaned.split(",")) {
      const match = term.trim().match(/^([A-Za-z_][A-Za-z0-9_]*(?:->>[A-Za-z_][A-Za-z0-9_]*)?)\.(eq|neq|gt|gte|lt|lte|is|like|ilike)\.(.*)$/);
      if (!match) continue;
      let value: unknown = match[3];
      if (value === "null") value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
      parsed.push({ field: match[1], op: match[2], value });
    }
    if (parsed.length) this.orGroups.push(parsed);
    return this;
  }
  order(field: string, options?: { ascending?: boolean }): this {
    this.orders.push({ field, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number): this {
    if (Number.isFinite(count)) this.pageLimit = Math.max(1, Math.min(200, Math.floor(count)));
    return this;
  }
  range(from: number, to: number): this {
    this.pageOffset = Math.max(0, Math.floor(from));
    this.pageLimit = Math.max(1, Math.min(200, Math.floor(to) - this.pageOffset + 1));
    return this;
  }
  single(): this { this.singleMode = "single"; return this; }
  maybeSingle(): this { this.singleMode = "maybeSingle"; return this; }

  private inferredStoreId(): string {
    const explicit = this.filters.find(filter => filter.field === "store_id" || filter.field === "storeId");
    if (explicit && typeof explicit.value === "string") return explicit.value;
    if (this.table === "stores_data") {
      const byId = this.filters.find(filter => filter.field === "id" && filter.op === "eq");
      if (byId && typeof byId.value === "string") return byId.value;
    }
    try {
      return localStorage.getItem("lastActiveStoreId") || "";
    } catch {
      return "";
    }
  }

  private async execute(): Promise<D1Result> {
    try {
      const filters = this.filters.filter(filter => filter.field !== "store_id" && filter.field !== "storeId");
      const params = new URLSearchParams();
      const storeId = this.inferredStoreId();
      if (storeId) params.set("storeId", storeId);
      if (filters.length || this.orGroups.length) {
        params.set("filters", JSON.stringify(filters));
        if (this.orGroups.length) params.set("orFilters", JSON.stringify(this.orGroups));
      }
      if (this.pageLimit !== null) params.set("limit", String(this.pageLimit));
      if (this.pageOffset) params.set("offset", String(this.pageOffset));
      if (this.orders.length) {
        params.set("orderBy", this.orders[0].field);
        params.set("ascending", String(this.orders[0].ascending));
      }
      if (this.singleMode) params.set(this.singleMode, "true");
      if (this.countMode) params.set("count", this.countMode);
      if (this.columns) params.set("select", this.columns);

      const path = `/api/v1/data/${encodeURIComponent(this.table)}${params.size ? `?${params.toString()}` : ""}`;
      let method = "GET";
      let body: string | undefined;
      const headers: Record<string, string> = {};

      if (this.operation === "insert" || this.operation === "upsert") {
        method = "POST";
        body = JSON.stringify(this.payload);
        if (this.upsertEnabled) headers["x-d1-upsert"] = "true";
      } else if (this.operation === "update") {
        method = "PATCH";
        body = JSON.stringify(this.payload || {});
      } else if (this.operation === "delete") {
        method = "DELETE";
      }

      const { response, body: result } = await apiRequest<any>(path, { method, body, headers });
      const error = normalizeError(result, response.status);
      if (error) return { data: null, error };

      if (this.singleMode) return { data: result?.item ?? null, error: null, count: result?.count };
      return { data: result?.items ?? result?.item ?? [], error: null, count: result?.count };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || "تعذر الاتصال بخادم Cloudflare." } };
    }
  }

  then<TResult1 = D1Result, TResult2 = never>(
    onfulfilled?: ((value: D1Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class D1PollingChannel {
  private registrations: Array<{ table: string; event: string; filter?: string; callback: (payload: any) => void }> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private snapshot = new Map<string, string>();
  constructor(private readonly name: string) {}

  on(_type: string, config: any, callback: (payload: any) => void): this {
    const table = String(config?.table || "");
    if (table) this.registrations.push({ table, event: String(config?.event || "*"), filter: config?.filter, callback });
    return this;
  }

  subscribe(callback?: (status: string) => void): this {
    if (this.timer) return this;
    const poll = async () => {
      for (const entry of this.registrations) {
        try {
          const storeId = (() => {
            try { return localStorage.getItem("lastActiveStoreId") || ""; } catch { return ""; }
          })();
          if (!storeId) continue;
          const url = new URLSearchParams({ storeId, limit: "200" });
          const response = await apiRequest<any>(`/api/v1/data/${encodeURIComponent(entry.table)}?${url.toString()}`);
          if (!response.response.ok || !Array.isArray(response.body?.items)) continue;
          for (const item of response.body.items) {
            const key = String(item?.id ?? item?.record_key ?? "");
            const fingerprint = JSON.stringify(item);
            const cacheKey = `${entry.table}:${key}`;
            if (this.snapshot.get(cacheKey) !== fingerprint) {
              const old = this.snapshot.get(cacheKey);
              this.snapshot.set(cacheKey, fingerprint);
              entry.callback({
                eventType: old ? "UPDATE" : "INSERT",
                new: item,
                old: null,
                table: entry.table
              });
            }
          }
        } catch {
          // Polling is best-effort; the next poll retries without blocking UI.
        }
      }
    };
    void poll();
    this.timer = setInterval(() => void poll(), 10_000);
    callback?.("SUBSCRIBED");
    return this;
  }

  unsubscribe(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function makeAuthUser(data: any): any {
  if (!data?.user) return null;
  return {
    id: data.user.id,
    email: data.user.email || null,
    phone: data.user.phone || null,
    user_metadata: { display_name: data.user.fullName || data.user.full_name || "" },
    app_metadata: {
      store_memberships: Array.isArray(data.memberships) ? data.memberships : [],
      is_platform_admin: data.isPlatformAdmin === true
    },
    is_anonymous: false,
    email_confirmed_at: data.user.emailConfirmedAt || null
  };
}

export function createCloudflareClient(): any {
  const subscribers = new Set<(event: string, session: any) => void>();
  let authUserCache: any = null;

  const loadMe = async () => {
    const { response, body } = await apiRequest<any>("/api/v1/auth/me");
    if (!response.ok || !body?.success) {
      authUserCache = null;
      return null;
    }
    authUserCache = makeAuthUser(body);
    return body;
  };

  const auth = {
    async getUser() {
      const body = await loadMe();
      return { data: { user: body ? makeAuthUser(body) : null }, error: null };
    },
    async getSession() {
      const body = await loadMe();
      if (!body) return { data: { session: null }, error: null };
      const user = makeAuthUser(body);
      return {
        data: {
          session: {
            access_token: "cloudflare-http-only-cookie",
            refresh_token: "",
            token_type: "bearer",
            expires_in: 60 * 60 * 24 * 14,
            user
          }
        },
        error: null
      };
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      subscribers.add(callback);
      void auth.getSession().then(result => callback("INITIAL_SESSION", result.data.session));
      const subscription = {
        unsubscribe: () => subscribers.delete(callback)
      };
      return { data: { subscription } };
    },
    async signInWithPassword(input: { email?: string; phone?: string; password: string }) {
      const login = input.phone || input.email || "";
      const { response, body } = await apiRequest<any>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password: input.password })
      });
      const error = normalizeError(body, response.status);
      if (error) return { data: { user: null, session: null }, error };
      const user = makeAuthUser(body);
      authUserCache = user;
      for (const callback of subscribers) callback("SIGNED_IN", await auth.getSession().then(r => r.data.session));
      return { data: { user, session: (await auth.getSession()).data.session }, error: null };
    },
    async signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const displayName = String(input.options?.data?.display_name || input.options?.data?.fullName || "");
      const phone = String(input.options?.data?.phone || "");
      const { response, body } = await apiRequest<any>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: input.email, password: input.password, displayName, phone })
      });
      const error = normalizeError(body, response.status);
      if (error) return { data: { user: null, session: null }, error };
      const user = makeAuthUser(body);
      authUserCache = user;
      for (const callback of subscribers) callback("SIGNED_IN", (await auth.getSession()).data.session);
      return { data: { user, session: (await auth.getSession()).data.session }, error: null };
    },
    async signOut() {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      authUserCache = null;
      for (const callback of subscribers) callback("SIGNED_OUT", null);
      return { error: null };
    },
    async updateUser(input: { password?: string }) {
      const { response, body } = await apiRequest<any>("/api/v1/auth/password/change", {
        method: "POST",
        body: JSON.stringify(input)
      });
      const error = normalizeError(body, response.status);
      return { data: { user: error ? null : await auth.getUser().then(r => r.data.user) }, error };
    },
    async resetPasswordForEmail(email: string) {
      const phoneOrEmail = email.trim();
      const { response, body } = await apiRequest<any>("/api/v1/auth/recovery/request", {
        method: "POST", body: JSON.stringify({ phoneOrEmail })
      });
      return { error: normalizeError(body, response.status) };
    },
    async resend(input: { type: string; email: string }) {
      const phoneOrEmail = input.email.trim();
      const { response, body } = await apiRequest<any>("/api/v1/auth/recovery/request", {
        method: "POST", body: JSON.stringify({ phoneOrEmail })
      });
      return { error: normalizeError(body, response.status) };
    }
  };

  return {
    auth,
    from(table: string) { return new D1QueryBuilder(table); },
    channel(name: string) { return new D1PollingChannel(name); },
    async removeChannel(channel: D1PollingChannel) { channel.unsubscribe(); },
    functions: {
      async invoke(name: string, options: { body?: unknown } = {}) {
        const routeMap: Record<string, string> = {
          "merchant-portal-requests": "/api/v1/merchant-requests",
          "store-manage-employee": "/api/v1/employees",
          "admin-list-users": "/api/v1/admin/users/list",
          "admin-create-user": "/api/v1/admin/users/create",
          "admin-delete-user": "/api/v1/admin/users/delete",
          "admin-update-user": "/api/v1/admin/users/update",
          "admin-add-store-owner": "/api/v1/admin/store-owners"
        };
        const path = routeMap[name] || `/api/v1/functions/${encodeURIComponent(name)}`;
        const { response, body } = await apiRequest<any>(path, {
          method: "POST", body: JSON.stringify(options.body || {})
        });
        return { data: body, error: normalizeError(body, response.status) };
      }
    }
  };
}
