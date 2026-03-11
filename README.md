# convex-invite-links

[![npm](https://img.shields.io/npm/v/convex-invite-links)](https://www.npmjs.com/package/convex-invite-links)
[![license](https://img.shields.io/npm/l/convex-invite-links)](https://github.com/TimpiaAI/convex-invite-links/blob/main/LICENSE)

A [Convex](https://convex.dev) component for **membership and invite management** — create shareable invite links with expiration, email locking, group/resource access control, and full lifecycle tracking.

Built for apps that need invite-based onboarding, team management, resource sharing, and access control.

> **Convex Components Challenge** — Invite Links: Membership Tracking, Invite Creation, Claiming, and HTTP Integration

## Features

- **Membership Tracking** — `isMember()`, `hasAccess()`, `getAllGroups()`, `getAllMembers()`, `addMember()`, `grantAccess()`
- **Generic Access Control** — Group-level and resource-level access, configurable per invite
- **Invite Creation** — `makeInvite()` with optional email/phone lock, expiration, destination URL, and metadata
- **Configurable Defaults** — Set default expiration at component initialization
- **Invite Revocation** — `revokeInvite()` to immediately invalidate by ID or token
- **Invite Listing** — `listInvites()` with filters for group, resource, user, and status
- **Invite Cleanup** — `deleteOldInvites()` for scheduled garbage collection
- **Invite Claiming** — `claimInvite()` validates token, checks recipient lock, auto-grants access
- **Pending Invite Check** — `hasInvite()` to check for unclaimed invites
- **HTTP Integration** — `handleInviteWebhook` for direct invite URL visits with social previews
- **URL Helpers** — `makeInviteUrl()` and `inviteFromUrl()` for link generation and parsing
- **Social Previews** — `og:title`, `og:description` metadata on invite pages
- **TypeScript** — Fully typed with exported interfaces for all result types

## Installation

```bash
npm install convex-invite-links
```

## Setup

### 1. Register the component

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import inviteLinks from "convex-invite-links/convex.config";

const app = defineApp();
app.use(inviteLinks);

export default app;
```

### 2. Initialize the client

```ts
// convex/invites.ts
import { InviteLinks } from "convex-invite-links";
import { components } from "./_generated/api.js";

const invites = new InviteLinks(components.inviteLinks, {
  defaultExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  baseUrl: "https://myapp.com/invite",
});
```

## Usage

### Create an invite

```ts
import { mutation } from "./_generated/server.js";
import { v } from "convex/values";

export const createInvite = mutation({
  args: { email: v.optional(v.string()), groupId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const result = await invites.makeInvite(ctx, {
      email: args.email,
      groupId: args.groupId,
      createdBy: userId,
      destinationUrl: "https://myapp.com/dashboard",
      metadata: { role: "member" },
      ogTitle: "Join My Team",
      ogDescription: "You've been invited to collaborate!",
    });

    // Generate a shareable URL
    const url = invites.makeInviteUrl(result.token);
    return { ...result, url };
  },
});
```

### Claim an invite

```ts
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const userEmail = await getUserEmail(ctx);

    const result = await invites.claimInvite(ctx, {
      token: args.token,
      userId,
      email: userEmail,
    });

    if (!result.ok) {
      throw new Error(`Invite invalid: ${result.reason}`);
      // reason: "invalid" | "expired" | "revoked" | "already_claimed"
      //         | "email_mismatch" | "phone_mismatch"
    }

    return {
      destinationUrl: result.destinationUrl,
      groupId: result.groupId,
    };
  },
});
```

### Check membership

```ts
export const checkAccess = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const isMember = await invites.isMember(ctx, {
      userId,
      groupId: args.groupId,
    });

    return { isMember };
  },
});
```

### Direct membership management

```ts
// Add a user to a group directly (without invite)
await invites.addMember(ctx, {
  userId: targetUserId,
  groupId: "team_123",
  addedBy: adminUserId,
});

// Grant resource access directly
await invites.grantAccess(ctx, {
  userId: targetUserId,
  resourceId: "doc_456",
  grantedBy: adminUserId,
});

// Remove membership or access
await invites.removeMember(ctx, { userId, groupId: "team_123" });
await invites.revokeAccess(ctx, { userId, resourceId: "doc_456" });
```

### Revoke and manage invites

```ts
// Revoke by ID
await invites.revokeInvite(ctx, { inviteId: "invite_id_here" });

// Revoke by token
await invites.revokeInviteByToken(ctx, { token: "inv_abc123..." });

// List pending invites for a group
const pending = await invites.listInvites(ctx, {
  groupId: "team_123",
});

// List all invites including claimed/expired
const all = await invites.listInvites(ctx, {
  groupId: "team_123",
  includeClaimed: true,
  includeRevoked: true,
  includeExpired: true,
});
```

### Schedule automatic cleanup

```ts
// In a cron job (convex/crons.ts)
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();
crons.daily("cleanup invites", { hourUTC: 3, minuteUTC: 0 }, internal.invites.cleanupOld);
export default crons;

// In your invites file
export const cleanupOld = internalMutation({
  handler: async (ctx) => {
    const deleted = await invites.deleteOldInvites(ctx, {
      olderThanMs: 30 * 24 * 60 * 60 * 1000,
    });
    console.log(`Cleaned up ${deleted} old invites`);
  },
});
```

### HTTP integration with social previews

```ts
import { handleInviteWebhook } from "convex-invite-links";
import { httpRouter } from "convex/server";

const http = httpRouter();

const inviteHandler = handleInviteWebhook(components.inviteLinks, {
  appName: "My App",
  redirectUrl: "https://myapp.com/accept-invite",
});

http.route({
  path: "/invite",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    return await inviteHandler(ctx, request);
  }),
});

export default http;
```

### Parse invite tokens from URLs

```ts
// In an HTTP action or server function
const token = invites.inviteFromUrl(request);
if (token) {
  const invite = await invites.getInviteByToken(ctx, { token });
  if (invite?.isValid) {
    // Show invite acceptance page
  }
}
```

## API Reference

### Membership

| Method | Context | Description |
|--------|---------|-------------|
| `isMember(ctx, args)` | query | Check if user is in a group |
| `hasAccess(ctx, args)` | query | Check if user has resource access |
| `getAllGroups(ctx, args)` | query | List groups for a user |
| `getAllMembers(ctx, args)` | query | List members of a group |
| `addMember(ctx, args)` | mutation | Add user to group |
| `removeMember(ctx, args)` | mutation | Remove user from group |
| `grantAccess(ctx, args)` | mutation | Grant resource access |
| `revokeAccess(ctx, args)` | mutation | Revoke resource access |

### Invite Management

| Method | Context | Description |
|--------|---------|-------------|
| `makeInvite(ctx, args)` | mutation | Create invite with optional locks |
| `revokeInvite(ctx, args)` | mutation | Revoke invite by ID |
| `revokeInviteByToken(ctx, args)` | mutation | Revoke invite by token |
| `listInvites(ctx, args?)` | query | List invites with filters |
| `deleteOldInvites(ctx, args?)` | mutation | Cleanup old invites |

### Invite Claiming

| Method | Context | Description |
|--------|---------|-------------|
| `claimInvite(ctx, args)` | mutation | Validate and apply invite |
| `hasInvite(ctx, args)` | query | Check for pending invites |
| `getInviteByToken(ctx, args)` | query | Get invite details by token |

### HTTP Integration

| Function | Description |
|----------|-------------|
| `handleInviteWebhook(component, options)` | HTTP handler with social preview metadata |
| `invites.makeInviteUrl(token)` | Generate shareable invite URL |
| `invites.inviteFromUrl(request)` | Parse token from URL/Request |

### Group Management

| Method | Context | Description |
|--------|---------|-------------|
| `upsertGroup(ctx, args)` | mutation | Create or update group |
| `getGroup(ctx, args)` | query | Get group details |

## Live Demo

Check out the [live demo](https://invite-links-demo.vercel.app) for a working example.

## Author

Built and maintained by [TimpiaAI](https://github.com/TimpiaAI).

## License

[MIT](https://github.com/TimpiaAI/convex-invite-links/blob/main/LICENSE)
