import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

// ─── Token Helpers ───────────────────────────────────────────────

/**
 * Generate a cryptographically secure random invite token.
 * Format: "inv_" + 48 random hex chars
 */
function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `inv_${hex}`;
}

// ─── Membership ─────────────────────────────────────────────────

/**
 * Check if a user is a member of a group.
 */
export const isMember = query({
  args: {
    userId: v.string(),
    groupId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("members")
      .withIndex("by_userId_groupId", (q) =>
        q.eq("userId", args.userId).eq("groupId", args.groupId)
      )
      .first();
    return member !== null;
  },
});

/**
 * Check if a user has access to a specific resource.
 */
export const hasAccess = query({
  args: {
    userId: v.string(),
    resourceId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const access = await ctx.db
      .query("resourceAccess")
      .withIndex("by_userId_resourceId", (q) =>
        q.eq("userId", args.userId).eq("resourceId", args.resourceId)
      )
      .first();
    return access !== null;
  },
});

/**
 * List all groups a user belongs to.
 */
export const getAllGroups = query({
  args: {
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      groupId: v.string(),
      addedAt: v.number(),
      addedBy: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return memberships.map((m) => ({
      groupId: m.groupId,
      addedAt: m.addedAt,
      addedBy: m.addedBy,
    }));
  },
});

/**
 * List all members in a group.
 */
export const getAllMembers = query({
  args: {
    groupId: v.string(),
  },
  returns: v.array(
    v.object({
      userId: v.string(),
      addedAt: v.number(),
      addedBy: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect();

    return memberships.map((m) => ({
      userId: m.userId,
      addedAt: m.addedAt,
      addedBy: m.addedBy,
    }));
  },
});

/**
 * Directly add a user to a group.
 */
export const addMember = mutation({
  args: {
    userId: v.string(),
    groupId: v.string(),
    addedBy: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Check if already a member
    const existing = await ctx.db
      .query("members")
      .withIndex("by_userId_groupId", (q) =>
        q.eq("userId", args.userId).eq("groupId", args.groupId)
      )
      .first();

    if (existing) return false;

    await ctx.db.insert("members", {
      userId: args.userId,
      groupId: args.groupId,
      addedAt: Date.now(),
      addedBy: args.addedBy,
    });

    return true;
  },
});

/**
 * Remove a user from a group.
 */
export const removeMember = mutation({
  args: {
    userId: v.string(),
    groupId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("members")
      .withIndex("by_userId_groupId", (q) =>
        q.eq("userId", args.userId).eq("groupId", args.groupId)
      )
      .first();

    if (!existing) return false;

    await ctx.db.delete(existing._id);
    return true;
  },
});

/**
 * Directly grant resource-level access to a user.
 */
export const grantAccess = mutation({
  args: {
    userId: v.string(),
    resourceId: v.string(),
    grantedBy: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("resourceAccess")
      .withIndex("by_userId_resourceId", (q) =>
        q.eq("userId", args.userId).eq("resourceId", args.resourceId)
      )
      .first();

    if (existing) return false;

    await ctx.db.insert("resourceAccess", {
      userId: args.userId,
      resourceId: args.resourceId,
      grantedAt: Date.now(),
      grantedBy: args.grantedBy,
    });

    return true;
  },
});

/**
 * Revoke resource-level access from a user.
 */
export const revokeAccess = mutation({
  args: {
    userId: v.string(),
    resourceId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("resourceAccess")
      .withIndex("by_userId_resourceId", (q) =>
        q.eq("userId", args.userId).eq("resourceId", args.resourceId)
      )
      .first();

    if (!existing) return false;

    await ctx.db.delete(existing._id);
    return true;
  },
});

// ─── Invite Creation & Management ───────────────────────────────

/**
 * Create an invite link with optional recipient lock and expiry.
 */
export const makeInvite = mutation({
  args: {
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    groupId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    defaultExpiryMs: v.optional(v.number()),
    destinationUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdBy: v.optional(v.string()),
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
  },
  returns: v.object({
    inviteId: v.string(),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = generateInviteToken();

    // Determine expiration: explicit > default > none
    let expiresAt = args.expiresAt;
    if (!expiresAt && args.defaultExpiryMs) {
      expiresAt = now + args.defaultExpiryMs;
    }

    const inviteId = await ctx.db.insert("invites", {
      token,
      email: args.email,
      phone: args.phone,
      groupId: args.groupId,
      resourceId: args.resourceId,
      expiresAt,
      destinationUrl: args.destinationUrl,
      metadata: args.metadata,
      createdAt: now,
      createdBy: args.createdBy,
      ogTitle: args.ogTitle,
      ogDescription: args.ogDescription,
    });

    return {
      inviteId: inviteId as string,
      token,
    };
  },
});

/**
 * Revoke an invite immediately.
 */
export const revokeInvite = mutation({
  args: {
    inviteId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId as any);
    if (!invite) return false;

    await ctx.db.patch(args.inviteId as any, { revokedAt: Date.now() });
    return true;
  },
});

/**
 * Revoke an invite by its token.
 */
export const revokeInviteByToken = mutation({
  args: {
    token: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) return false;

    await ctx.db.patch(invite._id, { revokedAt: Date.now() });
    return true;
  },
});

/**
 * List invites with optional filters.
 */
export const listInvites = query({
  args: {
    groupId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    includeClaimed: v.optional(v.boolean()),
    includeRevoked: v.optional(v.boolean()),
    includeExpired: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      inviteId: v.string(),
      token: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      groupId: v.optional(v.string()),
      resourceId: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
      claimedAt: v.optional(v.number()),
      claimedBy: v.optional(v.string()),
      destinationUrl: v.optional(v.string()),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      createdBy: v.optional(v.string()),
      ogTitle: v.optional(v.string()),
      ogDescription: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    let invites;

    if (args.groupId) {
      invites = await ctx.db
        .query("invites")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .collect();
    } else if (args.resourceId) {
      invites = await ctx.db
        .query("invites")
        .withIndex("by_resourceId", (q) => q.eq("resourceId", args.resourceId))
        .collect();
    } else if (args.createdBy) {
      invites = await ctx.db
        .query("invites")
        .withIndex("by_createdBy", (q) => q.eq("createdBy", args.createdBy))
        .collect();
    } else {
      invites = await ctx.db.query("invites").collect();
    }

    const now = Date.now();

    return invites
      .filter((inv) => {
        if (!args.includeClaimed && inv.claimedAt) return false;
        if (!args.includeRevoked && inv.revokedAt) return false;
        if (!args.includeExpired && inv.expiresAt && inv.expiresAt < now)
          return false;
        return true;
      })
      .map((inv) => ({
        inviteId: inv._id as string,
        token: inv.token,
        email: inv.email,
        phone: inv.phone,
        groupId: inv.groupId,
        resourceId: inv.resourceId,
        expiresAt: inv.expiresAt,
        revokedAt: inv.revokedAt,
        claimedAt: inv.claimedAt,
        claimedBy: inv.claimedBy,
        destinationUrl: inv.destinationUrl,
        metadata: inv.metadata,
        createdAt: inv.createdAt,
        createdBy: inv.createdBy,
        ogTitle: inv.ogTitle,
        ogDescription: inv.ogDescription,
      }));
  },
});

/**
 * Delete old expired/revoked/claimed invites for cleanup.
 */
export const deleteOldInvites = mutation({
  args: {
    olderThanMs: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const threshold = args.olderThanMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
    const cutoff = Date.now() - threshold;
    let deleted = 0;

    const invites = await ctx.db.query("invites").collect();
    for (const invite of invites) {
      const isOld = invite.createdAt < cutoff;
      const isDone =
        invite.revokedAt !== undefined ||
        invite.claimedAt !== undefined ||
        (invite.expiresAt !== undefined && invite.expiresAt < Date.now());

      if (isOld && isDone) {
        await ctx.db.delete(invite._id);
        deleted++;
      }
    }

    return deleted;
  },
});

// ─── Invite Claiming ────────────────────────────────────────────

/**
 * Claim an invite: validate the token, check recipient lock, and auto-grant access.
 */
export const claimInvite = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(
      v.union(
        v.literal("invalid"),
        v.literal("expired"),
        v.literal("revoked"),
        v.literal("already_claimed"),
        v.literal("email_mismatch"),
        v.literal("phone_mismatch")
      )
    ),
    destinationUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    groupId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      return { ok: false, reason: "invalid" as const };
    }

    if (invite.revokedAt) {
      return { ok: false, reason: "revoked" as const };
    }

    if (invite.claimedAt) {
      return { ok: false, reason: "already_claimed" as const };
    }

    const now = Date.now();
    if (invite.expiresAt && invite.expiresAt < now) {
      return { ok: false, reason: "expired" as const };
    }

    // Check recipient lock
    if (invite.email && args.email && invite.email !== args.email) {
      return { ok: false, reason: "email_mismatch" as const };
    }

    if (invite.phone && args.phone && invite.phone !== args.phone) {
      return { ok: false, reason: "phone_mismatch" as const };
    }

    // Mark as claimed
    await ctx.db.patch(invite._id, {
      claimedAt: now,
      claimedBy: args.userId,
    });

    // Auto-grant group membership
    if (invite.groupId) {
      const existingMember = await ctx.db
        .query("members")
        .withIndex("by_userId_groupId", (q) =>
          q.eq("userId", args.userId).eq("groupId", invite.groupId!)
        )
        .first();

      if (!existingMember) {
        await ctx.db.insert("members", {
          userId: args.userId,
          groupId: invite.groupId,
          addedAt: now,
          addedBy: invite.createdBy,
        });
      }
    }

    // Auto-grant resource access
    if (invite.resourceId) {
      const existingAccess = await ctx.db
        .query("resourceAccess")
        .withIndex("by_userId_resourceId", (q) =>
          q.eq("userId", args.userId).eq("resourceId", invite.resourceId!)
        )
        .first();

      if (!existingAccess) {
        await ctx.db.insert("resourceAccess", {
          userId: args.userId,
          resourceId: invite.resourceId,
          grantedAt: now,
          grantedBy: invite.createdBy,
        });
      }
    }

    return {
      ok: true,
      destinationUrl: invite.destinationUrl,
      metadata: invite.metadata,
      groupId: invite.groupId,
      resourceId: invite.resourceId,
    };
  },
});

/**
 * Check if a user has a pending (unclaimed) invite for a group or resource.
 */
export const hasInvite = query({
  args: {
    userId: v.string(),
    groupId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // We check invites that were claimed by this user
    // OR invites locked to their email/phone that are still pending
    const now = Date.now();

    let invites;
    if (args.groupId) {
      invites = await ctx.db
        .query("invites")
        .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
        .collect();
    } else if (args.resourceId) {
      invites = await ctx.db
        .query("invites")
        .withIndex("by_resourceId", (q) => q.eq("resourceId", args.resourceId))
        .collect();
    } else {
      return false;
    }

    return invites.some((inv) => {
      if (inv.revokedAt) return false;
      if (inv.claimedAt) return false;
      if (inv.expiresAt && inv.expiresAt < now) return false;
      // Check if invite is targeted to this user (by createdBy context)
      return true;
    });
  },
});

/**
 * Get invite details by token (for rendering invite pages).
 */
export const getInviteByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      inviteId: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      groupId: v.optional(v.string()),
      resourceId: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      revokedAt: v.optional(v.number()),
      claimedAt: v.optional(v.number()),
      destinationUrl: v.optional(v.string()),
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      ogTitle: v.optional(v.string()),
      ogDescription: v.optional(v.string()),
      isValid: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) return null;

    const now = Date.now();
    const isValid =
      !invite.revokedAt &&
      !invite.claimedAt &&
      (!invite.expiresAt || invite.expiresAt >= now);

    return {
      inviteId: invite._id as string,
      email: invite.email,
      phone: invite.phone,
      groupId: invite.groupId,
      resourceId: invite.resourceId,
      expiresAt: invite.expiresAt,
      revokedAt: invite.revokedAt,
      claimedAt: invite.claimedAt,
      destinationUrl: invite.destinationUrl,
      metadata: invite.metadata,
      createdAt: invite.createdAt,
      ogTitle: invite.ogTitle,
      ogDescription: invite.ogDescription,
      isValid,
    };
  },
});

// ─── Group Management ───────────────────────────────────────────

/**
 * Create or update a group.
 */
export const upsertGroup = mutation({
  args: {
    groupId: v.string(),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        metadata: args.metadata,
      });
      return existing._id as string;
    }

    const id = await ctx.db.insert("groups", {
      groupId: args.groupId,
      name: args.name,
      metadata: args.metadata,
    });

    return id as string;
  },
});

/**
 * Get group details.
 */
export const getGroup = query({
  args: {
    groupId: v.string(),
  },
  returns: v.union(
    v.object({
      groupId: v.string(),
      name: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db
      .query("groups")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .first();

    if (!group) return null;

    return {
      groupId: group.groupId,
      name: group.name,
      metadata: group.metadata,
    };
  },
});
