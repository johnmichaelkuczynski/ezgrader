import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  credits: integer("credits").default(0),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assignments = pgTable("assignments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  gradingInstructions: text("grading_instructions").notNull(),
  maxScore: integer("max_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const submissions = pgTable("submissions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  studentName: text("student_name"),
  studentEmail: text("student_email"),
  content: text("content").notNull(),
  aiProbability: doublePrecision("ai_probability"),
  isAIGenerated: boolean("is_ai_generated"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gradingResults = pgTable("grading_results", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  submissionId: integer("submission_id").references(() => submissions.id),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  temperature: doublePrecision("temperature"),
  grade: text("grade"), // Store the extracted or manually entered grade
  results: text("results").notNull(),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exemplars = pgTable("exemplars", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  temperature: doublePrecision("temperature"),
  referenceText: text("reference_text"),
  instructionsText: text("instructions_text"),
  includeAnnotations: boolean("include_annotations"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assignmentAttachments = pgTable("assignment_attachments", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  assignmentId: integer("assignment_id").references(() => assignments.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  content: text("content"), // Processed text content for text-based files
  filePath: text("file_path"), // For storing file path if using file system
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const purchases = pgTable("purchases", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  paypalOrderId: text("paypal_order_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(), // Amount in cents
  tokensAdded: integer("tokens_added").notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

export const tokenUsage = pgTable("token_usage", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // 'grading', 'perfect_essay', 'chat', 'storage', 'text_rewrite'
  tokensUsed: integer("tokens_used").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Text Rewriter Tables
export const rewriteSessions = pgTable("rewrite_sessions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  inputText: text("input_text").notNull(),
  styleSample: text("style_sample"), // Nullable since Box B is optional
  contextReference: text("context_reference"),
  customInstructions: text("custom_instructions"),
  llmProvider: text("llm_provider").notNull(),
  llmModel: text("llm_model").notNull(),
  temperature: doublePrecision("temperature").default(0.3),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rewriteResults = pgTable("rewrite_results", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  sessionId: integer("session_id").references(() => rewriteSessions.id),
  chunkIndex: integer("chunk_index").default(0),
  originalChunk: text("original_chunk").notNull(),
  rewrittenChunk: text("rewritten_chunk").notNull(),
  inputGptZeroScore: doublePrecision("input_gptzero_score"),
  outputGptZeroScore: doublePrecision("output_gptzero_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const styleSamples = pgTable("style_samples", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const instructionPresets = pgTable("instruction_presets", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  instructions: text("instructions").notNull(),
  category: text("category").default("general"),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  assignments: many(assignments),
  rewriteSessions: many(rewriteSessions),
}));

export const rewriteSessionsRelations = relations(rewriteSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [rewriteSessions.userId],
    references: [users.id],
  }),
  results: many(rewriteResults),
}));

export const rewriteResultsRelations = relations(rewriteResults, ({ one }) => ({
  session: one(rewriteSessions, {
    fields: [rewriteResults.sessionId],
    references: [rewriteSessions.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  user: one(users, {
    fields: [assignments.userId],
    references: [users.id],
  }),
  submissions: many(submissions),
  exemplars: many(exemplars),
  attachments: many(assignmentAttachments),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  gradingResults: many(gradingResults),
}));

export const gradingResultsRelations = relations(gradingResults, ({ one }) => ({
  submission: one(submissions, {
    fields: [gradingResults.submissionId],
    references: [submissions.id],
  }),
}));

export const exemplarsRelations = relations(exemplars, ({ one }) => ({
  assignment: one(assignments, {
    fields: [exemplars.assignmentId],
    references: [assignments.id],
  }),
}));

export const assignmentAttachmentsRelations = relations(assignmentAttachments, ({ one }) => ({
  assignment: one(assignments, {
    fields: [assignmentAttachments.assignmentId],
    references: [assignments.id],
  }),
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAssignmentSchema = createInsertSchema(assignments).pick({
  userId: true,
  title: true,
  prompt: true,
  gradingInstructions: true,
  maxScore: true,
});

export const insertSubmissionSchema = createInsertSchema(submissions).pick({
  assignmentId: true,
  studentName: true,
  studentEmail: true,
  content: true,
  aiProbability: true,
  isAIGenerated: true,
});

export const insertGradingResultSchema = createInsertSchema(gradingResults).pick({
  submissionId: true,
  llmProvider: true,
  llmModel: true,
  temperature: true,
  grade: true,
  results: true,
  emailSent: true,
});

export const insertExemplarSchema = createInsertSchema(exemplars).pick({
  assignmentId: true,
  llmProvider: true,
  llmModel: true,
  temperature: true,
  referenceText: true,
  instructionsText: true,
  includeAnnotations: true,
  content: true,
});

export const insertAssignmentAttachmentSchema = createInsertSchema(assignmentAttachments).pick({
  assignmentId: true,
  filename: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  content: true,
  filePath: true,
});

export const insertRewriteSessionSchema = createInsertSchema(rewriteSessions).pick({
  userId: true,
  inputText: true,
  styleSample: true,
  contextReference: true,
  customInstructions: true,
  llmProvider: true,
  llmModel: true,
  temperature: true,
});

export const insertRewriteResultSchema = createInsertSchema(rewriteResults).pick({
  sessionId: true,
  chunkIndex: true,
  originalChunk: true,
  rewrittenChunk: true,
  inputGptZeroScore: true,
  outputGptZeroScore: true,
});

export const insertStyleSampleSchema = createInsertSchema(styleSamples).pick({
  name: true,
  content: true,
  description: true,
  category: true,
  isDefault: true,
});

export const insertInstructionPresetSchema = createInsertSchema(instructionPresets).pick({
  name: true,
  instructions: true,
  category: true,
  description: true,
  isDefault: true,
});

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const purchaseSchema = z.object({
  tier: z.enum(["5", "10", "100", "1000"]),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

export type InsertGradingResult = z.infer<typeof insertGradingResultSchema>;
export type GradingResult = typeof gradingResults.$inferSelect;

export type InsertExemplar = z.infer<typeof insertExemplarSchema>;
export type Exemplar = typeof exemplars.$inferSelect;

export type InsertAssignmentAttachment = z.infer<typeof insertAssignmentAttachmentSchema>;
export type AssignmentAttachment = typeof assignmentAttachments.$inferSelect;

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type PurchaseRequest = z.infer<typeof purchaseSchema>;

export type Purchase = typeof purchases.$inferSelect;
export type TokenUsage = typeof tokenUsage.$inferSelect;

// AI Text Rewriter Types
export type InsertRewriteSession = z.infer<typeof insertRewriteSessionSchema>;
export type RewriteSession = typeof rewriteSessions.$inferSelect;

export type InsertRewriteResult = z.infer<typeof insertRewriteResultSchema>;
export type RewriteResult = typeof rewriteResults.$inferSelect;

export type InsertStyleSample = z.infer<typeof insertStyleSampleSchema>;
export type StyleSample = typeof styleSamples.$inferSelect;

export type InsertInstructionPreset = z.infer<typeof insertInstructionPresetSchema>;
export type InstructionPreset = typeof instructionPresets.$inferSelect;

// API request/response schemas for AI Text Rewriter
export const rewriteRequestSchema = z.object({
  inputText: z.string().min(1, "Input text is required"),
  styleSample: z.preprocess(v => (v == null ? "" : v), z.string()),
  contextReference: z.preprocess(v => (v == null ? "" : v), z.string()),
  customInstructions: z.preprocess(v => (v == null ? "" : v), z.string()), // <-- ChatGPT's fix
  llmProvider: z.enum(["openai", "anthropic", "deepseek", "perplexity"]),
  llmModel: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  useChunking: z.boolean().optional(),
});

export const gptZeroAnalysisSchema = z.object({
  text: z.string().min(1, "Text is required for analysis"),
});

export const uploadFileSchema = z.object({
  content: z.string(),
  filename: z.string(),
  mimeType: z.string(),
});

export type RewriteRequest = z.infer<typeof rewriteRequestSchema>;
export type GptZeroAnalysisRequest = z.infer<typeof gptZeroAnalysisSchema>;
export type UploadFileRequest = z.infer<typeof uploadFileSchema>;

// Additional interfaces for AI Text Rewriter
export interface TextChunk {
  id: string;
  content: string;
  startWord: number;
  endWord: number;
}

export interface GptZeroResult {
  aiScore: number; // Percentage (0-100)
  isAI: boolean;
  confidence: number;
  message?: string;
}
