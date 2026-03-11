import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Group membership tracking
  members: defineTable({
    userId: v.string(),
    groupId: v.string(),
    addedAt: v.number(),
    addedBy: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_groupId", ["groupId"])
    .index("by_userId_groupId", ["userId", "groupId"]),

  // Resource-level access tracking
  resourceAccess: defineTable({
    userId: v.string(),
    resourceId: v.string(),
    grantedAt: v.number(),
    grantedBy: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_resourceId", ["resourceId"])
    .index("by_userId_resourceId", ["userId", "resourceId"]),

  // Invite links
  invites: defineTable({
    // Secure random token for the invite URL
    token: v.string(),
    // Optional recipient lock
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    // What the invite grants access to
    groupId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    // Lifecycle
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    claimedAt: v.optional(v.number()),
    claimedBy: v.optional(v.string()),
    // Arbitrary attributes stored with the invite
    destinationUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
    // Audit
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
    // Social preview
    ogTitle: v.optional(v.string()),
    ogDescription: v.optional(v.string()),
  })
    .index("by_token", ["token"])
    .index("by_groupId", ["groupId"])
    .index("by_resourceId", ["resourceId"])
    .index("by_createdBy", ["createdBy"])
    .index("by_expiresAt", ["expiresAt"]),

  // Group metadata (optional)
  groups: defineTable({
    groupId: v.string(),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
  })
    .index("by_groupId", ["groupId"]),
});
