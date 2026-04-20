import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Roles Enum
export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  DEPARTMENT_ADMIN: "DEPARTMENT_ADMIN",
  CLUB_ADMIN: "CLUB_ADMIN",
  TEAM_LEAD: "TEAM_LEAD",
  STUDENT: "STUDENT",
} as const;

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: integer("role_id").notNull(),
  permissionId: integer("permission_id").notNull(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default(UserRole.STUDENT),
  departmentId: integer("department_id"),

  profileImage: text("profile_image"),      
  jntuNumber: text("jntu_number"),          
  year: integer("year"),                    

  isVerified: boolean("is_verified").default(false),
  refreshToken: text("refresh_token"),
  createdAt: timestamp("created_at").defaultNow(),
  clubId: integer("club_id"),
});


export const userDepartments = pgTable("user_departments", {
  id: serial("id").primaryKey(),

  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),

  departmentId: integer("department_id")
    .references(() => departments.id)
    .notNull(),

  role: text("role").default("ADMIN")
});


export const userClubs = pgTable("user_clubs", {
  id: serial("id").primaryKey(),

  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),

  clubId: integer("club_id")
    .references(() => clubs.id)
    .notNull(),

  role: text("role").default("CLUB_ADMIN")
});

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  logo: text("logo"),
  departmentId: integer("department_id"),
  maxMembers: integer("max_members").default(100) // ⭐ NEW
});
export const clubMembers = pgTable("club_members", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
}, (table) => {
  return {
    uniqueMember: {
      columns: [table.clubId, table.userId]
    }
  };
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clubId: integer("club_id").notNull(),
  joinToken: text("join_token"),
  joinTokenExpiry: timestamp("join_token_expiry"),
});

export const groupMembers = pgTable("group_members", {
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  expiryTime: timestamp("expiry_time"),
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  deadline: timestamp("deadline").notNull(),
  maxParticipants: integer("max_participants"),
  autoApprove: boolean("auto_approve").default(true),
  clubId: integer("club_id"),
  departmentId: integer("department_id"),
});

export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").default("PENDING"),
  attended: boolean("attended").default(false),
});

export const eventPasses = pgTable("event_passes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  userId: integer("user_id").notNull(),

  studentName: text("student_name").notNull(),
  studentEmail: text("student_email").notNull(),
  department: text("department").notNull(),

  qrData: text("qr_data").notNull(),
  validated: boolean("validated").default(false),   // ⭐ ADD
  validatedAt: timestamp("validated_at"),           // ⭐ ADD
  createdAt: timestamp("created_at").defaultNow()
});

export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),

  resultType: text("result_type") // INDIVIDUAL | TEAM
    .notNull(),

  teamName: text("team_name"),

  createdAt: timestamp("created_at").defaultNow(),
});

export const resultParticipants = pgTable("result_participants", {
  id: serial("id").primaryKey(),

  resultId: integer("result_id").notNull(),

  name: text("name").notNull(),
  jntuNumber: text("jntu_number"),
  email: text("email"),
  department: text("department"),

  position: integer("position").notNull(),

  badge: text("badge"), // Gold / Silver / Bronze
});


// ---------------- CERTIFICATES ----------------

export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id"), // optional (certificate may be event-based)
  title: text("title").notNull(),
  certificatePdf: text("certificate_pdf").notNull(),
  issuedBy: integer("issued_by"), // admin id
  createdAt: timestamp("created_at").defaultNow(),
});

export const departmentTemplates = pgTable("department_templates", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull(),
  templateHtml: text("template_html").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  eligibility: text("eligibility"),
  ctc: text("ctc"),
  interviewDate: timestamp("interview_date"),
  regLink: text("reg_link"),
});

export const companyPapers = pgTable("company_papers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  year: integer("year"),
  title: text("title"),
  question: text("question"),
  answer: text("answer"),
});

export const codingQuestions = pgTable("coding_questions", {
  id: serial("id").primaryKey(),
  title: text("title"),
  company: text("company"),
  companyLogo: text("company_logo"),
  difficulty: text("difficulty"),
  subject: text("subject"), // DSA / SQL / SYSTEM DESIGN
  tags: text("tags"), // Array, DP, Graph etc
  question: text("question"),
  answer: text("answer"),
});

export const aptitudeQuestions = pgTable("aptitude_questions", {
  id: serial("id").primaryKey(),
  topic: text("topic"),
  question: text("question"),
  answer: text("answer"),
});

export const reasoningQuestions = pgTable("reasoning_questions", {
  id: serial("id").primaryKey(),
  topic: text("topic"),
  question: text("question"),
  answer: text("answer"),
});

export const verbalQuestions = pgTable("verbal_questions", {
  id: serial("id").primaryKey(),
  topic: text("topic"),
  question: text("question"),
  answer: text("answer"),
});

export const dsaTopics = pgTable("dsa_topics", {
  id: serial("id").primaryKey(),
  title: text("title"),
  explanation: text("explanation"),
  importantAreas: text("important_areas"),
});

// export const placements = pgTable("placements", {
//   id: serial("id").primaryKey(),
//   userId: integer("user_id").notNull(),
//   companyId: integer("company_id").notNull(),
//   package: text("package"),
//   year: integer("year"),
//   offerLetterPdf: text("offer_letter_pdf"),
// });

export const placements = pgTable("placements", {
  id: serial("id").primaryKey(),

  companyName: text("company_name").notNull(),
  companyLogo: text("company_logo"),

  role: text("role").notNull(),
  roleDescription: text("role_description"),

  eligibility: text("eligibility"),
  package: text("package"),
  year: integer("year"),

  jdPdf: text("jd_pdf"),

  departmentId: integer("department_id").notNull(),

  createdAt: timestamp("created_at").defaultNow()
});

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  fileUrl: text("file_url"),
  link: text("link"),
  companyId: integer("company_id"),
  clubId: integer("club_id"),
  topic: text("topic"),
  departmentId: integer("department_id"),
});

export const materialsCategories = pgTable("materials_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull()
});

export const materialsSubCategories = pgTable("materials_subcategories", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .references(() => materialsCategories.id),
  name: text("name").notNull()
});

export const materialsTopics = pgTable("materials_topics", {
  id: serial("id").primaryKey(),
  subCategoryId: integer("sub_category_id")
    .references(() => materialsSubCategories.id),

  title: text("title").notNull(),

  theory: text("theory"),
  shortcuts: text("shortcuts"),
  formulas: text("formulas"),
  examples: text("examples")
});

export const banners = pgTable("banners", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  buttonText: text("button_text"),
  link: text("link"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
});

export const feedPosts = pgTable("feed_posts", {
  id: serial("id").primaryKey(),
  caption: text("caption"),
  mediaUrl: text("media_url"),
  likes: integer("likes").default(0),

  authorId: integer("author_id").notNull(),

  clubId: integer("club_id"),   

  createdAt: timestamp("created_at").defaultNow(),
});

export const feedLikes = pgTable("feed_likes", {
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
});

export const feedComments = pgTable("feed_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // null if global
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const supportSessions = pgTable("support_sessions", {
  id: serial("id").primaryKey(),

  studentId: integer("student_id").notNull(),
  studentName: text("student_name").notNull(),
  department: text("department").notNull(),
  year: integer("year").notNull(),

  query: text("query").notNull(),

  assignedTo: integer("assigned_to"), // team lead or club admin
  status: text("status").default("WAITING"), // WAITING / ACTIVE / CLOSED

  createdAt: timestamp("created_at").defaultNow()
});


export const supportMessages = pgTable("support_messages", {
  id: serial("id").primaryKey(),

  sessionId: integer("session_id").notNull(),
  senderId: integer("sender_id").notNull(),

  message: text("message"),
  fileUrl: text("file_url"),

  createdAt: timestamp("created_at").defaultNow()
});

// Auth Zod Schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, "Password must contain uppercase, lowercase, number, and special character"),
  name: z.string().min(2),
  role: z.string().optional(),
  departmentId: z.number().optional(),
});

// Zod schemas for forms
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertFeedPostSchema = createInsertSchema(feedPosts).omit({ id: true, createdAt: true });
export const insertClubSchema = createInsertSchema(clubs).omit({ id: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export const insertPlacementSchema = createInsertSchema(placements).omit({ id: true });
export const insertBannerSchema = createInsertSchema(banners).omit({ id: true });
export const insertResultSchema = createInsertSchema(results).omit({ id: true });
export const insertCertificateSchema =createInsertSchema(certificates).omit({ id: true, createdAt: true });

// Type exports
export type User = typeof users.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Event = typeof events.$inferSelect;
export type FeedPost = typeof feedPosts.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Placement = typeof placements.$inferSelect;
export type Banner = typeof banners.$inferSelect;
export type Result = typeof results.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;