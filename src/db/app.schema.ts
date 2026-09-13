import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth.schema";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull();

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull();

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  timezone: text("timezone").notNull().default("America/New_York"),
  senderName: text("sender_name"),
  senderDomain: text("sender_domain"),
  defaultEngines: text("default_engines"),
  slackWebhookUrl: text("slack_webhook_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_idx").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ],
);

export const brands = sqliteTable(
  "brands",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    siteUrl: text("site_url"),
    logoUrl: text("logo_url"),
    vertical: text("vertical"),
    category: text("category"),
    buyer: text("buyer"),
    job: text("job"),
    incumbent: text("incumbent"),
    constraintNote: text("constraint_note"),
    clientOwner: text("client_owner"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("brands_workspace_idx").on(table.workspaceId)],
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("competitors_brand_idx").on(table.brandId)],
);

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    mix: text("mix").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("prompts_brand_idx").on(table.brandId)],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    engineStates: text("engine_states"),
    /** True when this run is past the included weekly cap and is Dodo-metered. */
    extraRun: integer("extra_run", { mode: "boolean" }).notNull().default(false),
    /** True when a prepaid extra-run credit should be consumed after a report exists. */
    consumeCredit: integer("consume_credit", { mode: "boolean" }).notNull().default(false),
    /** Set when extra-run meter / credit settlement completed (idempotent). */
    billedAt: integer("billed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("runs_brand_idx").on(table.brandId),
    index("runs_status_idx").on(table.status),
  ],
);

export const runRows = sqliteTable(
  "run_rows",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    promptId: text("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    engine: text("engine").notNull(),
    mentioned: integer("mentioned", { mode: "boolean" }),
    recommended: integer("recommended", { mode: "boolean" }),
    rankInShortlist: integer("rank_in_shortlist"),
    citedUrls: text("cited_urls"),
    citedBrandUrl: integer("cited_brand_url", { mode: "boolean" }),
    whoWon: text("who_won"),
    othersNamed: text("others_named"),
    sentence: text("sentence"),
    nextAction: text("next_action"),
    rawAnswer: text("raw_answer"),
    gatewayRequestId: text("gateway_request_id"),
    confidence: text("confidence"),
    engineAt: integer("engine_at", { mode: "timestamp_ms" }),
    status: text("status").default("complete"),
    createdAt: createdAt(),
  },
  (table) => [
    index("run_rows_run_idx").on(table.runId),
    index("run_rows_prompt_engine_idx").on(table.promptId, table.engine),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    r2Key: text("r2_key"),
    htmlKey: text("html_key"),
    summary: text("summary"),
    agencyName: text("agency_name"),
    scoreMentioned: integer("score_mentioned"),
    scoreRecommended: integer("score_recommended"),
    scoreTotal: integer("score_total").notNull().default(20),
    shareToken: text("share_token").unique(),
    shareExpiresAt: integer("share_expires_at", { mode: "timestamp_ms" }),
    shareRevokedAt: integer("share_revoked_at", { mode: "timestamp_ms" }),
    shareOpenCount: integer("share_open_count").notNull().default(0),
    shareLastOpenedAt: integer("share_last_opened_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    approvalState: text("approval_state").notNull().default("needs_review"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedByUserId: text("approved_by_user_id"),
    suggestedEmailSubject: text("suggested_email_subject"),
    suggestedEmailBody: text("suggested_email_body"),
    createdAt: createdAt(),
  },
  (table) => [index("reports_brand_idx").on(table.brandId), index("reports_run_idx").on(table.runId)],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dodoCustomerId: text("dodo_customer_id"),
    dodoSubscriptionId: text("dodo_subscription_id"),
    plan: text("plan").notNull().default("agency"),
    status: text("status").notNull().default("none"),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
    brandsUsed: integer("brands_used").notNull().default(0),
    runsUsed: integer("runs_used").notNull().default(0),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
    extraBrands: integer("extra_brands").notNull().default(0),
    extraRuns: integer("extra_runs").notNull().default(0),
    extraSeats: integer("extra_seats").notNull().default(0),
    extraRunCredits: integer("extra_run_credits").notNull().default(0),
    premiumEnginePack: integer("premium_engine_pack", { mode: "boolean" }).notNull().default(false),
    billingInterval: text("billing_interval").notNull().default("monthly"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("subscriptions_workspace_idx").on(table.workspaceId),
    uniqueIndex("subscriptions_dodo_subscription_idx").on(table.dodoSubscriptionId),
  ],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("dodo"),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: text("payload"),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    replayedAt: integer("replayed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("webhook_events_event_id_idx").on(table.eventId)],
);




export const workspaceInvites = sqliteTable(
  "workspace_invites",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("workspace_invites_workspace_idx").on(table.workspaceId),
    index("workspace_invites_email_idx").on(table.email),
  ],
);

export const brandKits = sqliteTable("brand_kits", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#0B3D2E"),
  footerText: text("footer_text"),
  preparedBy: text("prepared_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    actorUserId: text("actor_user_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: text("metadata"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_workspace_idx").on(table.workspaceId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_idx").on(table.createdAt),
  ],
);

export const engineCache = sqliteTable(
  "engine_cache",
  {
    id: text("id").primaryKey(),
    cacheKey: text("cache_key").notNull().unique(),
    engine: text("engine").notNull(),
    promptText: text("prompt_text").notNull(),
    rawAnswer: text("raw_answer").notNull(),
    extractedJson: text("extracted_json"),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("engine_cache_expires_idx").on(table.expiresAt),
    index("engine_cache_key_idx").on(table.cacheKey),
  ],
);

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  brands: many(brands),
  subscriptions: many(subscriptions),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [brands.workspaceId],
    references: [workspaces.id],
  }),
  competitors: many(competitors),
  prompts: many(prompts),
  runs: many(runs),
  reports: many(reports),
}));

export const competitorsRelations = relations(competitors, ({ one }) => ({
  brand: one(brands, {
    fields: [competitors.brandId],
    references: [brands.id],
  }),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  brand: one(brands, {
    fields: [prompts.brandId],
    references: [brands.id],
  }),
  runRows: many(runRows),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  brand: one(brands, {
    fields: [runs.brandId],
    references: [brands.id],
  }),
  rows: many(runRows),
  reports: many(reports),
}));

export const runRowsRelations = relations(runRows, ({ one }) => ({
  run: one(runs, {
    fields: [runRows.runId],
    references: [runs.id],
  }),
  prompt: one(prompts, {
    fields: [runRows.promptId],
    references: [prompts.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  run: one(runs, {
    fields: [reports.runId],
    references: [runs.id],
  }),
  brand: one(brands, {
    fields: [reports.brandId],
    references: [brands.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [subscriptions.workspaceId],
    references: [workspaces.id],
  }),
}));


export const brandKitsRelations = relations(brandKits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [brandKits.workspaceId],
    references: [workspaces.id],
  }),
}));
