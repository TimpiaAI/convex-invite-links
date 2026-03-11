import type { api } from "../component/_generated/api.js";

type ComponentApi = typeof api;

// Context types for running component functions from the app
interface RunMutationCtx {
  runMutation: <Args extends Record<string, any>, Returns>(
    ref: any,
    args: Args
  ) => Promise<Returns>;
}

interface RunQueryCtx {
  runQuery: <Args extends Record<string, any>, Returns>(
    ref: any,
    args: Args
  ) => Promise<Returns>;
}

// ─── Result Types ────────────────────────────────────────────────

export interface MakeInviteResult {
  inviteId: string;
  token: string;
}

export interface ClaimInviteResult {
  ok: boolean;
  reason?:
    | "invalid"
    | "expired"
    | "revoked"
    | "already_claimed"
    | "email_mismatch"
    | "phone_mismatch";
  destinationUrl?: string;
  metadata?: any;
  groupId?: string;
  resourceId?: string;
}

export interface InviteInfo {
  inviteId: string;
  token: string;
  email?: string;
  phone?: string;
  groupId?: string;
  resourceId?: string;
  expiresAt?: number;
  revokedAt?: number;
  claimedAt?: number;
  claimedBy?: string;
  destinationUrl?: string;
  metadata?: any;
  createdAt: number;
  createdBy?: string;
  ogTitle?: string;
  ogDescription?: string;
}

export interface InviteDetails {
  inviteId: string;
  email?: string;
  phone?: string;
  groupId?: string;
  resourceId?: string;
  expiresAt?: number;
  revokedAt?: number;
  claimedAt?: number;
  destinationUrl?: string;
  metadata?: any;
  createdAt: number;
  ogTitle?: string;
  ogDescription?: string;
  isValid: boolean;
}

export interface MemberInfo {
  userId: string;
  addedAt: number;
  addedBy?: string;
}

export interface GroupMembership {
  groupId: string;
  addedAt: number;
  addedBy?: string;
}

export interface GroupInfo {
  groupId: string;
  name?: string;
  metadata?: any;
}

// ─── Options ─────────────────────────────────────────────────────

export interface InviteLinksOptions {
  /**
   * Default expiration time in milliseconds for new invites.
   * If set, invites without an explicit expiresAt will expire after this duration.
   */
  defaultExpiryMs?: number;

  /**
   * Base URL for generating invite links.
   * Example: "https://myapp.com/invite"
   */
  baseUrl?: string;
}

// ─── Main Client Class ──────────────────────────────────────────

/**
 * Client for the Invite Links component.
 *
 * Usage:
 * ```ts
 * import { InviteLinks } from "convex-invite-links";
 * import { components } from "./_generated/api.js";
 *
 * const invites = new InviteLinks(components.inviteLinks, {
 *   defaultExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   baseUrl: "https://myapp.com/invite",
 * });
 * ```
 */
export class InviteLinks {
  public component: ComponentApi;
  private defaultExpiryMs?: number;
  private baseUrl?: string;

  constructor(component: ComponentApi, options?: InviteLinksOptions) {
    this.component = component;
    this.defaultExpiryMs = options?.defaultExpiryMs;
    this.baseUrl = options?.baseUrl;
  }

  // ─── Membership ─────────────────────────────────────────────

  /**
   * Check if a user is a member of a group.
   */
  async isMember(
    ctx: RunQueryCtx,
    args: { userId: string; groupId: string }
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.public.isMember, args);
  }

  /**
   * Check if a user has access to a specific resource.
   */
  async hasAccess(
    ctx: RunQueryCtx,
    args: { userId: string; resourceId: string }
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.public.hasAccess, args);
  }

  /**
   * List all groups a user belongs to.
   */
  async getAllGroups(
    ctx: RunQueryCtx,
    args: { userId: string }
  ): Promise<GroupMembership[]> {
    return await ctx.runQuery(this.component.public.getAllGroups, args);
  }

  /**
   * List all members of a group.
   */
  async getAllMembers(
    ctx: RunQueryCtx,
    args: { groupId: string }
  ): Promise<MemberInfo[]> {
    return await ctx.runQuery(this.component.public.getAllMembers, args);
  }

  /**
   * Directly add a user to a group.
   * Returns false if user is already a member.
   */
  async addMember(
    ctx: RunMutationCtx,
    args: { userId: string; groupId: string; addedBy?: string }
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.public.addMember, args);
  }

  /**
   * Remove a user from a group.
   * Returns false if user was not a member.
   */
  async removeMember(
    ctx: RunMutationCtx,
    args: { userId: string; groupId: string }
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.public.removeMember, args);
  }

  /**
   * Directly grant resource-level access to a user.
   * Returns false if access already granted.
   */
  async grantAccess(
    ctx: RunMutationCtx,
    args: { userId: string; resourceId: string; grantedBy?: string }
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.public.grantAccess, args);
  }

  /**
   * Revoke resource-level access from a user.
   * Returns false if user had no access.
   */
  async revokeAccess(
    ctx: RunMutationCtx,
    args: { userId: string; resourceId: string }
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.public.revokeAccess, args);
  }

  // ─── Invite Creation & Management ─────────────────────────

  /**
   * Create an invite link with optional recipient lock and expiry.
   * Returns the invite ID and token.
   *
   * The token is a secure random string — use makeInviteUrl() to generate
   * a shareable link.
   */
  async makeInvite(
    ctx: RunMutationCtx,
    args: {
      email?: string;
      phone?: string;
      groupId?: string;
      resourceId?: string;
      expiresAt?: number;
      destinationUrl?: string;
      metadata?: any;
      createdBy?: string;
      ogTitle?: string;
      ogDescription?: string;
    }
  ): Promise<MakeInviteResult> {
    return await ctx.runMutation(this.component.public.makeInvite, {
      ...args,
      defaultExpiryMs: this.defaultExpiryMs,
    });
  }

  /**
   * Revoke an invite immediately by its ID.
   */
  async revokeInvite(
    ctx: RunMutationCtx,
    args: { inviteId: string }
  ): Promise<boolean> {
    return await ctx.runMutation(this.component.public.revokeInvite, args);
  }

  /**
   * Revoke an invite immediately by its token.
   */
  async revokeInviteByToken(
    ctx: RunMutationCtx,
    args: { token: string }
  ): Promise<boolean> {
    return await ctx.runMutation(
      this.component.public.revokeInviteByToken,
      args
    );
  }

  /**
   * List invites with optional filters.
   * By default excludes claimed, revoked, and expired invites.
   */
  async listInvites(
    ctx: RunQueryCtx,
    args?: {
      groupId?: string;
      resourceId?: string;
      createdBy?: string;
      includeClaimed?: boolean;
      includeRevoked?: boolean;
      includeExpired?: boolean;
    }
  ): Promise<InviteInfo[]> {
    return await ctx.runQuery(
      this.component.public.listInvites,
      args ?? {}
    );
  }

  /**
   * Delete old expired/revoked/claimed invites.
   * Call on a schedule (e.g. daily cron) to keep the database clean.
   *
   * @param olderThanMs - Delete invites older than this (default: 30 days)
   * @returns Number of invites deleted
   */
  async deleteOldInvites(
    ctx: RunMutationCtx,
    args?: { olderThanMs?: number }
  ): Promise<number> {
    return await ctx.runMutation(
      this.component.public.deleteOldInvites,
      args ?? {}
    );
  }

  // ─── Invite Claiming ──────────────────────────────────────

  /**
   * Claim an invite: validate the token, check recipient lock, and auto-grant access.
   *
   * If the invite has a groupId, the user is added as a group member.
   * If the invite has a resourceId, the user is granted resource access.
   * If the invite is email/phone locked, pass the user's email/phone to verify.
   */
  async claimInvite(
    ctx: RunMutationCtx,
    args: {
      token: string;
      userId: string;
      email?: string;
      phone?: string;
    }
  ): Promise<ClaimInviteResult> {
    return await ctx.runMutation(this.component.public.claimInvite, args);
  }

  /**
   * Check if there are any pending invites for a group or resource.
   */
  async hasInvite(
    ctx: RunQueryCtx,
    args: {
      userId: string;
      groupId?: string;
      resourceId?: string;
    }
  ): Promise<boolean> {
    return await ctx.runQuery(this.component.public.hasInvite, args);
  }

  /**
   * Get invite details by token (for rendering invite pages).
   */
  async getInviteByToken(
    ctx: RunQueryCtx,
    args: { token: string }
  ): Promise<InviteDetails | null> {
    return await ctx.runQuery(this.component.public.getInviteByToken, args);
  }

  // ─── Group Management ─────────────────────────────────────

  /**
   * Create or update a group with optional name and metadata.
   */
  async upsertGroup(
    ctx: RunMutationCtx,
    args: { groupId: string; name?: string; metadata?: any }
  ): Promise<string> {
    return await ctx.runMutation(this.component.public.upsertGroup, args);
  }

  /**
   * Get group details.
   */
  async getGroup(
    ctx: RunQueryCtx,
    args: { groupId: string }
  ): Promise<GroupInfo | null> {
    return await ctx.runQuery(this.component.public.getGroup, args);
  }

  // ─── URL Helpers ──────────────────────────────────────────

  /**
   * Generate a shareable invite URL from a token.
   * Uses the baseUrl configured in the constructor.
   *
   * @example
   * ```ts
   * const url = invites.makeInviteUrl("inv_abc123...");
   * // "https://myapp.com/invite?token=inv_abc123..."
   * ```
   */
  makeInviteUrl(token: string): string {
    if (!this.baseUrl) {
      throw new Error(
        "baseUrl is not set. Pass it in the InviteLinks constructor options."
      );
    }
    const url = new URL(this.baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }

  /**
   * Parse an invite token from a URL or Request object.
   * Extracts the "token" query parameter.
   *
   * @example
   * ```ts
   * const token = invites.inviteFromUrl(request);
   * if (token) {
   *   const invite = await invites.getInviteByToken(ctx, { token });
   * }
   * ```
   */
  inviteFromUrl(requestOrUrl: Request | string | URL): string | null {
    let url: URL;
    if (requestOrUrl instanceof Request) {
      url = new URL(requestOrUrl.url);
    } else if (requestOrUrl instanceof URL) {
      url = requestOrUrl;
    } else {
      url = new URL(requestOrUrl);
    }
    return url.searchParams.get("token");
  }
}

// ─── HTTP Integration Helpers ────────────────────────────────────

/**
 * Create an HTTP handler for invite link visits.
 * Returns an HTML page with social preview metadata and redirect logic.
 *
 * Usage in your Convex HTTP routes:
 * ```ts
 * import { handleInviteWebhook } from "convex-invite-links";
 *
 * const handler = handleInviteWebhook(components.inviteLinks, {
 *   appName: "My App",
 *   redirectUrl: "https://myapp.com/accept-invite",
 * });
 *
 * http.route({ path: "/invite", method: "GET", handler });
 * ```
 */
export function handleInviteWebhook(
  component: ComponentApi,
  options: {
    appName?: string;
    redirectUrl: string;
  }
) {
  return async (ctx: RunQueryCtx, request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing invite token", { status: 400 });
    }

    const invite = await ctx.runQuery(component.public.getInviteByToken, {
      token,
    }) as InviteDetails | null;

    if (!invite) {
      return new Response("Invite not found", { status: 404 });
    }

    const title = invite.ogTitle ?? `${options.appName ?? "App"} Invite`;
    const description =
      invite.ogDescription ?? "You've been invited! Click to accept.";

    // Redirect URL with token
    const redirectUrl = new URL(options.redirectUrl);
    redirectUrl.searchParams.set("token", token);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl.toString())}">
</head>
<body>
  <p>Redirecting to ${escapeHtml(options.appName ?? "the app")}...</p>
  <p><a href="${escapeHtml(redirectUrl.toString())}">Click here if not redirected</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  };
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default InviteLinks;
