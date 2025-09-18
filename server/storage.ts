import { users, type User, type InsertUser, assignments, type Assignment, type InsertAssignment, submissions, type Submission, type InsertSubmission, gradingResults, type GradingResult, type InsertGradingResult, exemplars, type Exemplar, type InsertExemplar, assignmentAttachments, type AssignmentAttachment, type InsertAssignmentAttachment, rewriteSessions, type RewriteSession, type InsertRewriteSession, rewriteResults, type RewriteResult, type InsertRewriteResult, styleSamples, type StyleSample, type InsertStyleSample, instructionPresets, type InstructionPreset, type InsertInstructionPreset } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

// Define a type for the student grade records
export interface StudentGradeRecord {
  submissionId: number;
  studentName: string;
  assignmentId: number;
  assignmentTitle: string;
  grade: string | null;
  submissionDate: Date;
  results: string;
}

// Storage interface with CRUD methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Assignment methods
  getAssignment(id: number): Promise<Assignment | undefined>;
  getAssignmentsByUserId(userId: number): Promise<Assignment[]>;
  createAssignment(assignment: InsertAssignment): Promise<Assignment>;
  updateAssignment(id: number, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined>;
  deleteAssignment(id: number): Promise<boolean>;
  
  // Submission methods
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionsByAssignmentId(assignmentId: number): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: number, submission: Partial<InsertSubmission>): Promise<Submission | undefined>;
  deleteSubmission(id: number): Promise<boolean>;
  
  // Grading Result methods
  getGradingResult(id: number): Promise<GradingResult | undefined>;
  getGradingResultsBySubmissionId(submissionId: number): Promise<GradingResult[]>;
  createGradingResult(gradingResult: InsertGradingResult): Promise<GradingResult>;
  updateGradingResult(id: number, gradingResult: Partial<InsertGradingResult>): Promise<GradingResult | undefined>;
  deleteGradingResult(id: number): Promise<boolean>;
  
  // Exemplar methods
  getExemplar(id: number): Promise<Exemplar | undefined>;
  getExemplarsByAssignmentId(assignmentId: number): Promise<Exemplar[]>;
  createExemplar(exemplar: InsertExemplar): Promise<Exemplar>;
  updateExemplar(id: number, exemplar: Partial<InsertExemplar>): Promise<Exemplar | undefined>;
  deleteExemplar(id: number): Promise<boolean>;
  
  // Assignment Attachment methods
  getAssignmentAttachment(id: number): Promise<AssignmentAttachment | undefined>;
  getAssignmentAttachmentsByAssignmentId(assignmentId: number): Promise<AssignmentAttachment[]>;
  createAssignmentAttachment(attachment: InsertAssignmentAttachment): Promise<AssignmentAttachment>;
  updateAssignmentAttachment(id: number, attachment: Partial<InsertAssignmentAttachment>): Promise<AssignmentAttachment | undefined>;
  deleteAssignmentAttachment(id: number): Promise<boolean>;
  
  // Student Records methods
  getAllSubmissionsWithGrades(): Promise<StudentGradeRecord[]>;
  
  // AI Text Rewriter methods
  // Rewrite Session methods
  getRewriteSession(id: number): Promise<RewriteSession | undefined>;
  getRewriteSessionsByUserId(userId: number): Promise<RewriteSession[]>;
  createRewriteSession(session: InsertRewriteSession): Promise<RewriteSession>;
  updateRewriteSession(id: number, session: Partial<InsertRewriteSession>): Promise<RewriteSession | undefined>;
  deleteRewriteSession(id: number): Promise<boolean>;
  
  // Rewrite Result methods
  getRewriteResult(id: number): Promise<RewriteResult | undefined>;
  getRewriteResultsBySessionId(sessionId: number): Promise<RewriteResult[]>;
  createRewriteResult(result: InsertRewriteResult): Promise<RewriteResult>;
  updateRewriteResult(id: number, result: Partial<InsertRewriteResult>): Promise<RewriteResult | undefined>;
  deleteRewriteResult(id: number): Promise<boolean>;
  
  // Style Sample methods
  getStyleSample(id: number): Promise<StyleSample | undefined>;
  getAllStyleSamples(): Promise<StyleSample[]>;
  createStyleSample(sample: InsertStyleSample): Promise<StyleSample>;
  updateStyleSample(id: number, sample: Partial<InsertStyleSample>): Promise<StyleSample | undefined>;
  deleteStyleSample(id: number): Promise<boolean>;
  
  // Instruction Preset methods
  getInstructionPreset(id: number): Promise<InstructionPreset | undefined>;
  getAllInstructionPresets(): Promise<InstructionPreset[]>;
  createInstructionPreset(preset: InsertInstructionPreset): Promise<InstructionPreset>;
  updateInstructionPreset(id: number, preset: Partial<InsertInstructionPreset>): Promise<InstructionPreset | undefined>;
  deleteInstructionPreset(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }
  
  // Assignment methods
  async getAssignment(id: number): Promise<Assignment | undefined> {
    const result = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
    return result[0];
  }
  
  async getAssignmentsByUserId(userId: number): Promise<Assignment[]> {
    return await db.select().from(assignments).where(eq(assignments.userId, userId));
  }
  
  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const result = await db.insert(assignments).values(assignment).returning();
    return result[0];
  }
  
  async updateAssignment(id: number, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const result = await db.update(assignments).set(assignment).where(eq(assignments.id, id)).returning();
    return result[0];
  }
  
  async deleteAssignment(id: number): Promise<boolean> {
    const result = await db.delete(assignments).where(eq(assignments.id, id)).returning({ id: assignments.id });
    return result.length > 0;
  }
  
  // Submission methods
  async getSubmission(id: number): Promise<Submission | undefined> {
    const result = await db.select().from(submissions).where(eq(submissions.id, id)).limit(1);
    return result[0];
  }
  
  async getSubmissionsByAssignmentId(assignmentId: number): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.assignmentId, assignmentId));
  }
  
  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const result = await db.insert(submissions).values(submission).returning();
    return result[0];
  }
  
  async updateSubmission(id: number, submission: Partial<InsertSubmission>): Promise<Submission | undefined> {
    const result = await db.update(submissions).set(submission).where(eq(submissions.id, id)).returning();
    return result[0];
  }
  
  async deleteSubmission(id: number): Promise<boolean> {
    const result = await db.delete(submissions).where(eq(submissions.id, id)).returning({ id: submissions.id });
    return result.length > 0;
  }
  
  // Grading Result methods
  async getGradingResult(id: number): Promise<GradingResult | undefined> {
    const result = await db.select().from(gradingResults).where(eq(gradingResults.id, id)).limit(1);
    return result[0];
  }
  
  async getGradingResultsBySubmissionId(submissionId: number): Promise<GradingResult[]> {
    return await db.select().from(gradingResults).where(eq(gradingResults.submissionId, submissionId));
  }
  
  async createGradingResult(gradingResult: InsertGradingResult): Promise<GradingResult> {
    const result = await db.insert(gradingResults).values(gradingResult).returning();
    return result[0];
  }
  
  async updateGradingResult(id: number, gradingResult: Partial<InsertGradingResult>): Promise<GradingResult | undefined> {
    const result = await db.update(gradingResults).set(gradingResult).where(eq(gradingResults.id, id)).returning();
    return result[0];
  }
  
  async deleteGradingResult(id: number): Promise<boolean> {
    const result = await db.delete(gradingResults).where(eq(gradingResults.id, id)).returning({ id: gradingResults.id });
    return result.length > 0;
  }
  
  // Exemplar methods
  async getExemplar(id: number): Promise<Exemplar | undefined> {
    const result = await db.select().from(exemplars).where(eq(exemplars.id, id)).limit(1);
    return result[0];
  }
  
  async getExemplarsByAssignmentId(assignmentId: number): Promise<Exemplar[]> {
    return await db.select().from(exemplars).where(eq(exemplars.assignmentId, assignmentId));
  }
  
  async createExemplar(exemplar: InsertExemplar): Promise<Exemplar> {
    const result = await db.insert(exemplars).values(exemplar).returning();
    return result[0];
  }
  
  async updateExemplar(id: number, exemplar: Partial<InsertExemplar>): Promise<Exemplar | undefined> {
    const result = await db.update(exemplars).set(exemplar).where(eq(exemplars.id, id)).returning();
    return result[0];
  }
  
  async deleteExemplar(id: number): Promise<boolean> {
    const result = await db.delete(exemplars).where(eq(exemplars.id, id)).returning({ id: exemplars.id });
    return result.length > 0;
  }
  
  // Student Records methods
  async getAllSubmissionsWithGrades(): Promise<StudentGradeRecord[]> {
    // Join submissions, grading_results, and assignments tables
    const result = await db.execute(sql`
      SELECT 
        s.id as submission_id,
        s.student_name,
        s.assignment_id,
        a.title as assignment_title,
        gr.grade,
        s.created_at as submission_date,
        gr.results
      FROM ${submissions} s
      JOIN ${assignments} a ON s.assignment_id = a.id
      LEFT JOIN ${gradingResults} gr ON gr.submission_id = s.id
      ORDER BY s.created_at DESC
    `);
    
    // Map the raw SQL result to our StudentGradeRecord interface
    return (result.rows as any[]).map(row => ({
      submissionId: row.submission_id,
      studentName: row.student_name,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      grade: row.grade,
      submissionDate: row.submission_date,
      results: row.results || ''
    }));
  }

  // Assignment Attachment methods
  async getAssignmentAttachment(id: number): Promise<AssignmentAttachment | undefined> {
    const result = await db.select().from(assignmentAttachments).where(eq(assignmentAttachments.id, id));
    return result[0];
  }

  async getAssignmentAttachmentsByAssignmentId(assignmentId: number): Promise<AssignmentAttachment[]> {
    return await db.select().from(assignmentAttachments).where(eq(assignmentAttachments.assignmentId, assignmentId));
  }

  async createAssignmentAttachment(attachment: InsertAssignmentAttachment): Promise<AssignmentAttachment> {
    const result = await db.insert(assignmentAttachments).values(attachment).returning();
    return result[0];
  }

  async updateAssignmentAttachment(id: number, attachment: Partial<InsertAssignmentAttachment>): Promise<AssignmentAttachment | undefined> {
    const result = await db.update(assignmentAttachments).set(attachment).where(eq(assignmentAttachments.id, id)).returning();
    return result[0];
  }

  async deleteAssignmentAttachment(id: number): Promise<boolean> {
    const result = await db.delete(assignmentAttachments).where(eq(assignmentAttachments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // AI Text Rewriter methods - DatabaseStorage implementation
  // Rewrite Session methods
  async getRewriteSession(id: number): Promise<RewriteSession | undefined> {
    const result = await db.select().from(rewriteSessions).where(eq(rewriteSessions.id, id)).limit(1);
    return result[0];
  }

  async getRewriteSessionsByUserId(userId: number): Promise<RewriteSession[]> {
    return await db.select().from(rewriteSessions).where(eq(rewriteSessions.userId, userId));
  }

  async createRewriteSession(session: InsertRewriteSession): Promise<RewriteSession> {
    const result = await db.insert(rewriteSessions).values(session).returning();
    return result[0];
  }

  async updateRewriteSession(id: number, session: Partial<InsertRewriteSession>): Promise<RewriteSession | undefined> {
    const result = await db.update(rewriteSessions).set(session).where(eq(rewriteSessions.id, id)).returning();
    return result[0];
  }

  async deleteRewriteSession(id: number): Promise<boolean> {
    const result = await db.delete(rewriteSessions).where(eq(rewriteSessions.id, id)).returning({ id: rewriteSessions.id });
    return result.length > 0;
  }

  // Rewrite Result methods
  async getRewriteResult(id: number): Promise<RewriteResult | undefined> {
    const result = await db.select().from(rewriteResults).where(eq(rewriteResults.id, id)).limit(1);
    return result[0];
  }

  async getRewriteResultsBySessionId(sessionId: number): Promise<RewriteResult[]> {
    return await db.select().from(rewriteResults).where(eq(rewriteResults.sessionId, sessionId));
  }

  async createRewriteResult(result: InsertRewriteResult): Promise<RewriteResult> {
    const insertResult = await db.insert(rewriteResults).values(result).returning();
    return insertResult[0];
  }

  async updateRewriteResult(id: number, result: Partial<InsertRewriteResult>): Promise<RewriteResult | undefined> {
    const updateResult = await db.update(rewriteResults).set(result).where(eq(rewriteResults.id, id)).returning();
    return updateResult[0];
  }

  async deleteRewriteResult(id: number): Promise<boolean> {
    const result = await db.delete(rewriteResults).where(eq(rewriteResults.id, id)).returning({ id: rewriteResults.id });
    return result.length > 0;
  }

  // Style Sample methods
  async getStyleSample(id: number): Promise<StyleSample | undefined> {
    const result = await db.select().from(styleSamples).where(eq(styleSamples.id, id)).limit(1);
    return result[0];
  }

  async getAllStyleSamples(): Promise<StyleSample[]> {
    return await db.select().from(styleSamples);
  }

  async createStyleSample(sample: InsertStyleSample): Promise<StyleSample> {
    const result = await db.insert(styleSamples).values(sample).returning();
    return result[0];
  }

  async updateStyleSample(id: number, sample: Partial<InsertStyleSample>): Promise<StyleSample | undefined> {
    const result = await db.update(styleSamples).set(sample).where(eq(styleSamples.id, id)).returning();
    return result[0];
  }

  async deleteStyleSample(id: number): Promise<boolean> {
    const result = await db.delete(styleSamples).where(eq(styleSamples.id, id)).returning({ id: styleSamples.id });
    return result.length > 0;
  }

  // Instruction Preset methods
  async getInstructionPreset(id: number): Promise<InstructionPreset | undefined> {
    const result = await db.select().from(instructionPresets).where(eq(instructionPresets.id, id)).limit(1);
    return result[0];
  }

  async getAllInstructionPresets(): Promise<InstructionPreset[]> {
    return await db.select().from(instructionPresets);
  }

  async createInstructionPreset(preset: InsertInstructionPreset): Promise<InstructionPreset> {
    const result = await db.insert(instructionPresets).values(preset).returning();
    return result[0];
  }

  async updateInstructionPreset(id: number, preset: Partial<InsertInstructionPreset>): Promise<InstructionPreset | undefined> {
    const result = await db.update(instructionPresets).set(preset).where(eq(instructionPresets.id, id)).returning();
    return result[0];
  }

  async deleteInstructionPreset(id: number): Promise<boolean> {
    const result = await db.delete(instructionPresets).where(eq(instructionPresets.id, id)).returning({ id: instructionPresets.id });
    return result.length > 0;
  }
}

// Export a DatabaseStorage instance instead of MemStorage
// Temporarily use in-memory storage due to database connection issues
export class MemStorage implements IStorage {
  private users: User[] = [];
  private assignments: Assignment[] = [];
  private submissions: Submission[] = [];
  private gradingResults: GradingResult[] = [];
  private exemplars: Exemplar[] = [];
  private assignmentAttachments: AssignmentAttachment[] = [];
  private rewriteSessions: RewriteSession[] = [];
  private rewriteResults: RewriteResult[] = [];
  private styleSamples: StyleSample[] = [];
  private instructionPresets: InstructionPreset[] = [];
  private nextId = 1;

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { 
      id: this.nextId++, 
      username: user.username,
      email: user.email!,
      password: user.password || null,
      credits: 0,
      stripeCustomerId: null,
      createdAt: new Date()
    };
    this.users.push(newUser);
    return newUser;
  }

  // Assignment methods
  async getAssignment(id: number): Promise<Assignment | undefined> {
    return this.assignments.find(a => a.id === id);
  }

  async getAssignmentsByUserId(userId: number): Promise<Assignment[]> {
    return this.assignments.filter(a => a.userId === userId);
  }

  async createAssignment(assignment: InsertAssignment): Promise<Assignment> {
    const newAssignment: Assignment = { 
      id: this.nextId++, 
      createdAt: new Date(), 
      userId: assignment.userId || null,
      title: assignment.title,
      prompt: assignment.prompt,
      gradingInstructions: assignment.gradingInstructions,
      maxScore: assignment.maxScore || null
    };
    this.assignments.push(newAssignment);
    return newAssignment;
  }

  async updateAssignment(id: number, assignment: Partial<InsertAssignment>): Promise<Assignment | undefined> {
    const index = this.assignments.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    this.assignments[index] = { 
      ...this.assignments[index], 
      title: assignment.title ?? this.assignments[index].title,
      prompt: assignment.prompt ?? this.assignments[index].prompt,
      gradingInstructions: assignment.gradingInstructions ?? this.assignments[index].gradingInstructions,
      maxScore: assignment.maxScore ?? this.assignments[index].maxScore,
      userId: assignment.userId ?? this.assignments[index].userId
    };
    return this.assignments[index];
  }

  async deleteAssignment(id: number): Promise<boolean> {
    const index = this.assignments.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.assignments.splice(index, 1);
    return true;
  }

  // Submission methods
  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.find(s => s.id === id);
  }

  async getSubmissionsByAssignmentId(assignmentId: number): Promise<Submission[]> {
    return this.submissions.filter(s => s.assignmentId === assignmentId);
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const newSubmission: Submission = { 
      id: this.nextId++, 
      createdAt: new Date(), 
      assignmentId: submission.assignmentId || null,
      studentName: submission.studentName || null,
      studentEmail: submission.studentEmail || null,
      content: submission.content,
      aiProbability: submission.aiProbability || null,
      isAIGenerated: submission.isAIGenerated || null
    };
    this.submissions.push(newSubmission);
    return newSubmission;
  }

  async updateSubmission(id: number, submission: Partial<InsertSubmission>): Promise<Submission | undefined> {
    const index = this.submissions.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.submissions[index] = { 
      ...this.submissions[index], 
      content: submission.content ?? this.submissions[index].content,
      studentName: submission.studentName ?? this.submissions[index].studentName,
      studentEmail: submission.studentEmail ?? this.submissions[index].studentEmail,
      aiProbability: submission.aiProbability ?? this.submissions[index].aiProbability,
      isAIGenerated: submission.isAIGenerated ?? this.submissions[index].isAIGenerated,
      assignmentId: submission.assignmentId ?? this.submissions[index].assignmentId
    };
    return this.submissions[index];
  }

  async deleteSubmission(id: number): Promise<boolean> {
    const index = this.submissions.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.submissions.splice(index, 1);
    return true;
  }

  // Grading Result methods
  async getGradingResult(id: number): Promise<GradingResult | undefined> {
    return this.gradingResults.find(g => g.id === id);
  }

  async getGradingResultsBySubmissionId(submissionId: number): Promise<GradingResult[]> {
    return this.gradingResults.filter(g => g.submissionId === submissionId);
  }

  async createGradingResult(gradingResult: InsertGradingResult): Promise<GradingResult> {
    const newResult: GradingResult = { 
      id: this.nextId++, 
      createdAt: new Date(),
      submissionId: gradingResult.submissionId || null,
      llmProvider: gradingResult.llmProvider,
      llmModel: gradingResult.llmModel,
      temperature: gradingResult.temperature || null,
      grade: gradingResult.grade || null,
      results: gradingResult.results,
      emailSent: gradingResult.emailSent || null
    };
    this.gradingResults.push(newResult);
    return newResult;
  }

  async updateGradingResult(id: number, gradingResult: Partial<InsertGradingResult>): Promise<GradingResult | undefined> {
    const index = this.gradingResults.findIndex(g => g.id === id);
    if (index === -1) return undefined;
    this.gradingResults[index] = { ...this.gradingResults[index], ...gradingResult };
    return this.gradingResults[index];
  }

  async deleteGradingResult(id: number): Promise<boolean> {
    const index = this.gradingResults.findIndex(g => g.id === id);
    if (index === -1) return false;
    this.gradingResults.splice(index, 1);
    return true;
  }

  // Exemplar methods
  async getExemplar(id: number): Promise<Exemplar | undefined> {
    return this.exemplars.find(e => e.id === id);
  }

  async getExemplarsByAssignmentId(assignmentId: number): Promise<Exemplar[]> {
    return this.exemplars.filter(e => e.assignmentId === assignmentId);
  }

  async createExemplar(exemplar: InsertExemplar): Promise<Exemplar> {
    const newExemplar: Exemplar = { 
      id: this.nextId++, 
      createdAt: new Date(),
      assignmentId: exemplar.assignmentId || null,
      content: exemplar.content,
      llmProvider: exemplar.llmProvider,
      llmModel: exemplar.llmModel,
      temperature: exemplar.temperature || null,
      referenceText: exemplar.referenceText || null,
      instructionsText: exemplar.instructionsText || null,
      includeAnnotations: exemplar.includeAnnotations || null
    };
    this.exemplars.push(newExemplar);
    return newExemplar;
  }

  async updateExemplar(id: number, exemplar: Partial<InsertExemplar>): Promise<Exemplar | undefined> {
    const index = this.exemplars.findIndex(e => e.id === id);
    if (index === -1) return undefined;
    this.exemplars[index] = { ...this.exemplars[index], ...exemplar };
    return this.exemplars[index];
  }

  async deleteExemplar(id: number): Promise<boolean> {
    const index = this.exemplars.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.exemplars.splice(index, 1);
    return true;
  }

  // Assignment Attachment methods
  async getAssignmentAttachment(id: number): Promise<AssignmentAttachment | undefined> {
    return this.assignmentAttachments.find(a => a.id === id);
  }

  async getAssignmentAttachmentsByAssignmentId(assignmentId: number): Promise<AssignmentAttachment[]> {
    return this.assignmentAttachments.filter(a => a.assignmentId === assignmentId);
  }

  async createAssignmentAttachment(attachment: InsertAssignmentAttachment): Promise<AssignmentAttachment> {
    const newAttachment: AssignmentAttachment = { 
      id: this.nextId++, 
      assignmentId: attachment.assignmentId || null,
      content: attachment.content || null,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      filePath: attachment.filePath || null,
      uploadedAt: new Date()
    };
    this.assignmentAttachments.push(newAttachment);
    return newAttachment;
  }

  async updateAssignmentAttachment(id: number, attachment: Partial<InsertAssignmentAttachment>): Promise<AssignmentAttachment | undefined> {
    const index = this.assignmentAttachments.findIndex(a => a.id === id);
    if (index === -1) return undefined;
    this.assignmentAttachments[index] = { ...this.assignmentAttachments[index], ...attachment };
    return this.assignmentAttachments[index];
  }

  async deleteAssignmentAttachment(id: number): Promise<boolean> {
    const index = this.assignmentAttachments.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.assignmentAttachments.splice(index, 1);
    return true;
  }

  // Student Records methods
  async getAllSubmissionsWithGrades(): Promise<StudentGradeRecord[]> {
    const records: StudentGradeRecord[] = [];
    
    for (const submission of this.submissions) {
      const assignment = this.assignments.find(a => a.id === submission.assignmentId);
      const gradingResult = this.gradingResults.find(g => g.submissionId === submission.id);
      
      if (assignment) {
        records.push({
          submissionId: submission.id,
          studentName: submission.studentName || 'Unknown Student',
          assignmentId: assignment.id,
          assignmentTitle: assignment.title || 'Untitled Assignment',
          grade: gradingResult?.grade || null,
          submissionDate: submission.createdAt || new Date(),
          results: gradingResult?.results || ''
        });
      }
    }
    
    return records;
  }

  // AI Text Rewriter methods - MemStorage implementation
  // Rewrite Session methods
  async getRewriteSession(id: number): Promise<RewriteSession | undefined> {
    return this.rewriteSessions.find(s => s.id === id);
  }

  async getRewriteSessionsByUserId(userId: number): Promise<RewriteSession[]> {
    return this.rewriteSessions.filter(s => s.userId === userId);
  }

  async createRewriteSession(session: InsertRewriteSession): Promise<RewriteSession> {
    const newSession: RewriteSession = {
      id: this.nextId++,
      ...session,
      createdAt: new Date()
    };
    this.rewriteSessions.push(newSession);
    return newSession;
  }

  async updateRewriteSession(id: number, session: Partial<InsertRewriteSession>): Promise<RewriteSession | undefined> {
    const index = this.rewriteSessions.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.rewriteSessions[index] = { ...this.rewriteSessions[index], ...session };
    return this.rewriteSessions[index];
  }

  async deleteRewriteSession(id: number): Promise<boolean> {
    const index = this.rewriteSessions.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.rewriteSessions.splice(index, 1);
    return true;
  }

  // Rewrite Result methods
  async getRewriteResult(id: number): Promise<RewriteResult | undefined> {
    return this.rewriteResults.find(r => r.id === id);
  }

  async getRewriteResultsBySessionId(sessionId: number): Promise<RewriteResult[]> {
    return this.rewriteResults.filter(r => r.sessionId === sessionId);
  }

  async createRewriteResult(result: InsertRewriteResult): Promise<RewriteResult> {
    const newResult: RewriteResult = {
      id: this.nextId++,
      ...result,
      createdAt: new Date()
    };
    this.rewriteResults.push(newResult);
    return newResult;
  }

  async updateRewriteResult(id: number, result: Partial<InsertRewriteResult>): Promise<RewriteResult | undefined> {
    const index = this.rewriteResults.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    this.rewriteResults[index] = { ...this.rewriteResults[index], ...result };
    return this.rewriteResults[index];
  }

  async deleteRewriteResult(id: number): Promise<boolean> {
    const index = this.rewriteResults.findIndex(r => r.id === id);
    if (index === -1) return false;
    this.rewriteResults.splice(index, 1);
    return true;
  }

  // Style Sample methods
  async getStyleSample(id: number): Promise<StyleSample | undefined> {
    return this.styleSamples.find(s => s.id === id);
  }

  async getAllStyleSamples(): Promise<StyleSample[]> {
    return [...this.styleSamples];
  }

  async createStyleSample(sample: InsertStyleSample): Promise<StyleSample> {
    const newSample: StyleSample = {
      id: this.nextId++,
      ...sample,
      createdAt: new Date()
    };
    this.styleSamples.push(newSample);
    return newSample;
  }

  async updateStyleSample(id: number, sample: Partial<InsertStyleSample>): Promise<StyleSample | undefined> {
    const index = this.styleSamples.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.styleSamples[index] = { ...this.styleSamples[index], ...sample };
    return this.styleSamples[index];
  }

  async deleteStyleSample(id: number): Promise<boolean> {
    const index = this.styleSamples.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.styleSamples.splice(index, 1);
    return true;
  }

  // Instruction Preset methods
  async getInstructionPreset(id: number): Promise<InstructionPreset | undefined> {
    return this.instructionPresets.find(p => p.id === id);
  }

  async getAllInstructionPresets(): Promise<InstructionPreset[]> {
    return [...this.instructionPresets];
  }

  async createInstructionPreset(preset: InsertInstructionPreset): Promise<InstructionPreset> {
    const newPreset: InstructionPreset = {
      id: this.nextId++,
      ...preset,
      createdAt: new Date()
    };
    this.instructionPresets.push(newPreset);
    return newPreset;
  }

  async updateInstructionPreset(id: number, preset: Partial<InsertInstructionPreset>): Promise<InstructionPreset | undefined> {
    const index = this.instructionPresets.findIndex(p => p.id === id);
    if (index === -1) return undefined;
    this.instructionPresets[index] = { ...this.instructionPresets[index], ...preset };
    return this.instructionPresets[index];
  }

  async deleteInstructionPreset(id: number): Promise<boolean> {
    const index = this.instructionPresets.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.instructionPresets.splice(index, 1);
    return true;
  }
}

export const storage = new DatabaseStorage();
