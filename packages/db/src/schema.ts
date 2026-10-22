import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("membership_role", ["admin", "editor", "viewer"]);
export const documentStatusEnum = pgEnum("document_status", [
  "uploaded",
  "queued",
  "processing",
  "processed",
  "failed",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  invitedBy: uuid("invited_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: varchar("mime_type", { length: 120 }),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  status: documentStatusEnum("status").notNull().default("uploaded"),
  summary: text("summary"),
  extractedTextPath: text("extracted_text_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const documentJobs = pgTable("document_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  jobType: varchar("job_type", { length: 100 }).notNull(),
  status: jobStatusEnum("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentEmbeddings = pgTable("document_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  chunkId: uuid("chunk_id")
    .notNull()
    .references(() => documentChunks.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  maxDocuments: integer("max_documents").notNull(),
  maxStorageMb: integer("max_storage_mb").notNull(),
  features: jsonb("features").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  metricType: varchar("metric_type", { length: 80 }).notNull(),
  value: integer("value").notNull().default(0),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
