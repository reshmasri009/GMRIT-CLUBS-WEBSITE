import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

export interface IStorage {

  // FEED EXTRA ACTIONS
getFeedPosts(limit?: number, offset?: number): Promise<schema.FeedPost[]>;
likeFeedPost(postId: number): Promise<void>;
deleteFeedPost(postId: number): Promise<void>;
updateFeedPost(
  postId: number,
  data: Partial<schema.FeedPost>
): Promise<schema.FeedPost>;

getAgentSessions(agentId:number):Promise<any[]>;
getStudentSession(studentId:number):Promise<any>;


getMaterialCategories():Promise<any[]>
createMaterialCategory(data:any):Promise<any>

getMaterialSubCategories(categoryId:number):Promise<any[]>
createMaterialSubCategory(data:any):Promise<any>

getMaterialTopics(subCategoryId:number):Promise<any[]>
getMaterialTopic(id:number):Promise<any>

createMaterialTopic(data:any):Promise<any>

createSupportSession(data:any):Promise<any>;
getWaitingSessions():Promise<any[]>;
assignSupportAgent(sessionId:number, agentId:number):Promise<void>;
sendSupportMessage(data:any):Promise<any>;
getSupportMessages(sessionId:number):Promise<any[]>;

registerForEvent(eventId:number, userId:number): Promise<void>;
getEventRegistrations(eventId:number): Promise<any[]>;

createEventPass(eventId:number, userId:number, data:any): Promise<void>;
getUserEventPass(eventId:number, userId:number): Promise<any>;
getEventRegistrationsCount(eventId:number): Promise<number>;

  getUser(id: number): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;

  getAllUsers(): Promise<schema.User[]>;
  updateUserRole(id: number, role: string): Promise<void>;

  getClubs(): Promise<schema.Club[]>;
  createClub(club: Omit<schema.Club, "id">): Promise<schema.Club>;

  getAnnouncements(): Promise<schema.Announcement[]>;
  createAnnouncement(ann: Omit<schema.Announcement, "id" | "createdAt">): Promise<schema.Announcement>;

  getEvents(): Promise<schema.Event[]>;
  createEvent(event: Omit<schema.Event, "id">): Promise<schema.Event>;

  createFeedPost(post: Omit<schema.FeedPost, "id" | "createdAt">): Promise<schema.FeedPost>;
  
  getCompanies(): Promise<schema.Company[]>;
  createCompany(company: Omit<schema.Company, "id">): Promise<schema.Company>;
  
  getMaterials(): Promise<schema.Material[]>;
  createMaterial(material: Omit<schema.Material, "id">): Promise<schema.Material>;
  
  getPlacementsByDepartment(departmentId: number): Promise<schema.Placement[]>;
  createPlacement(placement: Omit<schema.Placement, "id">): Promise<schema.Placement>;
  
  getBanners(): Promise<schema.Banner[]>;
  createBanner(banner: Omit<schema.Banner, "id">): Promise<schema.Banner>;
  
  getResults(): Promise<any[]>;
  getResultsByClub(clubId: number): Promise<any[]>;
  createResult(result: Omit<schema.Result, "id">): Promise<schema.Result>;

  getEventsByDepartment(departmentId: number): Promise<schema.Event[]>;
  getEventsByClub(clubId: number): Promise<schema.Event[]>;

  getUsersByDepartment(departmentId: number): Promise<schema.User[]>;
  getUsersByClub(clubId: number): Promise<schema.User[]>;

  // ================= PLACEMENT PREPARATION =================

getCodingQuestions(): Promise<any[]>;
createCodingQuestion(data:any): Promise<any>;

getAptitudeQuestions(): Promise<any[]>;
createAptitudeQuestion(data:any): Promise<any>;

getReasoningQuestions(): Promise<any[]>;
createReasoningQuestion(data:any): Promise<any>;

getVerbalQuestions(): Promise<any[]>;
createVerbalQuestion(data:any): Promise<any>;

getDsaTopics(): Promise<any[]>;
createDsaTopic(data:any): Promise<any>;


}

export class DatabaseStorage implements IStorage {

  async getUser(id: number): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async createSupportSession(data:any){
  const [session] = await db
    .insert(schema.supportSessions)
    .values(data)
    .returning();

  return session;
}

async getWaitingSessions(){
  return db
    .select()
    .from(schema.supportSessions)
    .where(eq(schema.supportSessions.status,"WAITING"));
}

async getStudentSession(studentId:number){
  const [session] = await db
    .select()
    .from(schema.supportSessions)
    .where(eq(schema.supportSessions.studentId,studentId));

  return session;
}

async getAgentSessions(agentId:number){
  return db
    .select()
    .from(schema.supportSessions)
    .where(eq(schema.supportSessions.assignedTo, agentId));
}

async assignSupportAgent(sessionId:number,agentId:number){
  await db
    .update(schema.supportSessions)
    .set({
      assignedTo:agentId,
      status:"ACTIVE"
    })
    .where(eq(schema.supportSessions.id,sessionId));
}

async sendSupportMessage(data:any){
  const [msg] = await db
    .insert(schema.supportMessages)
    .values(data)
    .returning();

  return msg;
}

async getSupportMessages(sessionId:number){
  return db
    .select({
      message: schema.supportMessages.message,
      senderId: schema.supportMessages.senderId,
      senderName: schema.users.name
    })
    .from(schema.supportMessages)
    .leftJoin(
      schema.users,
      eq(schema.supportMessages.senderId, schema.users.id)
    )
    .where(eq(schema.supportMessages.sessionId, sessionId));
}
  
  async getProfileWithDepartment(userId: number) {
  const [user] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      profileImage: schema.users.profileImage,
      jntuNumber: schema.users.jntuNumber,
      year: schema.users.year,
      departmentId: schema.users.departmentId,
      departmentName: schema.departments.name,
    })
    .from(schema.users)
    .leftJoin(
      schema.departments,
      eq(schema.users.departmentId, schema.departments.id)
    )
    .where(eq(schema.users.id, userId));

  return user;
}

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async updateUser(id: number, data: any) {
  const [updated] = await db
    .update(schema.users)
    .set(data)
    .where(eq(schema.users.id, id))
    .returning();

  return updated;
}

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [created] = await db.insert(schema.users).values(user).returning();
    return created;
  }

  async getAllUsers(): Promise<schema.User[]> {
    return await db.select().from(schema.users);
  }

  async updateUserRole(id: number, role: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, id));
  }

  async getClubs(): Promise<schema.Club[]> {
    return await db.select().from(schema.clubs);
  }

  async createClub(club: Omit<schema.Club, "id">): Promise<schema.Club> {
    const [created] = await db.insert(schema.clubs).values(club).returning();
    return created;
  }

  // async getAnnouncements(): Promise<schema.Announcement[]> {
  //   return await db.select().from(schema.announcements);
  // }
  async getAnnouncements() {

  return db
    .select()
    .from(schema.announcements)
    .orderBy(
      sql`${schema.announcements.pinned} DESC,
          ${schema.announcements.createdAt} DESC`
    );

}

  async createAnnouncement(ann: Omit<schema.Announcement, "id" | "createdAt">): Promise<schema.Announcement> {
    const [created] = await db.insert(schema.announcements).values(ann).returning();
    return created;
  }

  async getEvents(): Promise<schema.Event[]> {
    return await db.select().from(schema.events);
  }

  async createEvent(event: Omit<schema.Event, "id">): Promise<schema.Event> {
    const [created] = await db.insert(schema.events).values(event).returning();
    return created;
  }

  async createFeedPost(post: Omit<schema.FeedPost, "id" | "createdAt">): Promise<schema.FeedPost> {
    const [created] = await db.insert(schema.feedPosts).values(post).returning();
    return created;
  }

  async getCompanies(): Promise<schema.Company[]> {
    return await db.select().from(schema.companies);
  }

  // ================= CODING QUESTIONS =================

async getCodingQuestions(){
  return db.select().from(schema.codingQuestions);
}

async createCodingQuestion(data:any){
  const [created] = await db
    .insert(schema.codingQuestions)
    .values(data)
    .returning();

  return created;
}


// ================= APTITUDE =================

async getAptitudeQuestions(){
  return db.select().from(schema.aptitudeQuestions);
}

async createAptitudeQuestion(data:any){
  const [created] = await db
    .insert(schema.aptitudeQuestions)
    .values(data)
    .returning();

  return created;
}


// ================= REASONING =================

async getReasoningQuestions(){
  return db.select().from(schema.reasoningQuestions);
}

async createReasoningQuestion(data:any){
  const [created] = await db
    .insert(schema.reasoningQuestions)
    .values(data)
    .returning();

  return created;
}


// ================= VERBAL =================

async getVerbalQuestions(){
  return db.select().from(schema.verbalQuestions);
}

async createVerbalQuestion(data:any){
  const [created] = await db
    .insert(schema.verbalQuestions)
    .values(data)
    .returning();

  return created;
}


// ================= DSA =================

async getDsaTopics(){
  return db.select().from(schema.dsaTopics);
}

async createDsaTopic(data:any){
  const [created] = await db
    .insert(schema.dsaTopics)
    .values(data)
    .returning();

  return created;
}

  async createCompany(company: Omit<schema.Company, "id">): Promise<schema.Company> {
    const [created] = await db.insert(schema.companies).values(company).returning();
    return created;
  }

  async getMaterials(): Promise<schema.Material[]> {
    return await db.select().from(schema.materials);
  }

  async createMaterial(material: Omit<schema.Material, "id">): Promise<schema.Material> {
    const [created] = await db.insert(schema.materials).values(material).returning();
    return created;
  }

  async getPlacementsByDepartment(departmentId: number) {
  return db
    .select()
    .from(schema.placements)
    .where(eq(schema.placements.departmentId, departmentId));
}

  async createPlacement(placement: Omit<schema.Placement, "id">): Promise<schema.Placement> {
    const [created] = await db.insert(schema.placements).values(placement).returning();
    return created;
  }

  async getBanners(): Promise<schema.Banner[]> {
    return await db.select().from(schema.banners);
  }

  async createBanner(banner: Omit<schema.Banner, "id">): Promise<schema.Banner> {
    const [created] = await db.insert(schema.banners).values(banner).returning();
    return created;
  }

async getResults(): Promise<any[]> {

  return db
    .select({
      resultId: schema.results.id,

      eventName: schema.events.title,

      name: schema.resultParticipants.name,
      jntuNumber: schema.resultParticipants.jntuNumber,
      email: schema.resultParticipants.email,
      department: schema.resultParticipants.department,

      rank: schema.resultParticipants.position,
      badge: schema.resultParticipants.badge,

      teamName: schema.results.teamName,
      resultType: schema.results.resultType
    })

    .from(schema.results)

    .leftJoin(
      schema.events,
      eq(schema.results.eventId, schema.events.id)
    )

    .leftJoin(
      schema.resultParticipants,
      eq(schema.results.id, schema.resultParticipants.resultId)
    )

    .orderBy(schema.resultParticipants.position);

}


async deleteResult(resultId:number){

  await db
    .delete(schema.resultParticipants)
    .where(eq(schema.resultParticipants.resultId,resultId));

  await db
    .delete(schema.results)
    .where(eq(schema.results.id,resultId));

}

async updateWinner(id:number,data:any){

  await db
    .update(schema.resultParticipants)
    .set(data)
    .where(eq(schema.resultParticipants.id,id));

}

async getResultsByClub(clubId: number) {

  return db
    .select({
      resultId: schema.results.id,

      eventName: schema.events.title,

      name: schema.resultParticipants.name,
      jntuNumber: schema.resultParticipants.jntuNumber,
      email: schema.resultParticipants.email,
      department: schema.resultParticipants.department,

      rank: schema.resultParticipants.position,
      badge: schema.resultParticipants.badge,

      teamName: schema.results.teamName,
      resultType: schema.results.resultType
    })

    .from(schema.results)

    .leftJoin(
      schema.events,
      eq(schema.results.eventId, schema.events.id)
    )

    .leftJoin(
      schema.resultParticipants,
      eq(schema.results.id, schema.resultParticipants.resultId)
    )

    .where(eq(schema.events.clubId, clubId))

    .orderBy(schema.resultParticipants.position);

}

  async createResult(result: Omit<schema.Result, "id">): Promise<schema.Result> {
    const [created] = await db.insert(schema.results).values(result).returning();
    return created;
  }

      // ============================
    // SCOPED USER FETCHING
    // ============================

async getUsersByDepartment(departmentId: number) {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.departmentId, departmentId));
}

async getUsersByClub(clubId: number) {
  return db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clubId, clubId));
}

// ============================
// EVENT SCOPING
// ============================

async getEventsByClub(clubId: number) {
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.clubId, clubId));
}

async getEventsByDepartment(departmentId: number) {
  return db
    .select()
    .from(schema.events)
    .where(eq(schema.events.departmentId, departmentId));
}

// ============================
// FEED ACTIONS
// ============================

async getFeedPosts(limit = 8, offset = 0) {
  return db
    .select()
    .from(schema.feedPosts)
    .orderBy(sql`${schema.feedPosts.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}

async likeFeedPost(postId: number) {
  await db
    .update(schema.feedPosts)
    .set({ likes: sql`${schema.feedPosts.likes} + 1` })
    .where(eq(schema.feedPosts.id, postId));
}

async deleteFeedPost(postId: number) {
  await db
    .delete(schema.feedPosts)
    .where(eq(schema.feedPosts.id, postId));
}

async updateFeedPost(postId: number, data: Partial<schema.FeedPost>) {
  const [updated] = await db
    .update(schema.feedPosts)
    .set(data)
    .where(eq(schema.feedPosts.id, postId))
    .returning();

  return updated;
}

// REGISTER USER
// async registerForEvent(eventId:number, userId:number) {
//   await db.insert(schema.eventRegistrations)
//     .values({ eventId, userId });
// }

async registerForEvent(eventId:number, userId:number) {

  const existing = await db
    .select()
    .from(schema.eventRegistrations)
    .where(
      sql`${schema.eventRegistrations.eventId}=${eventId}
      AND ${schema.eventRegistrations.userId}=${userId}`
    );

  if (existing.length === 0) {
    await db.insert(schema.eventRegistrations)
      .values({ eventId, userId });
  }
}

// ADMIN VIEW USERS
// async getEventRegistrations(eventId:number) {

//   return db
//     .select({
//       userId: schema.users.id,
//       name: schema.users.name,
//       email: schema.users.email,
//     })
//     .from(schema.eventRegistrations)
//     .leftJoin(
//       schema.users,
//       eq(schema.eventRegistrations.userId, schema.users.id)
//     )
//     .where(eq(schema.eventRegistrations.eventId, eventId));

// }

async getEventRegistrations(eventId:number) {

  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      validated: schema.eventPasses.validated
    })
    .from(schema.eventRegistrations)

    .leftJoin(
      schema.users,
      eq(schema.eventRegistrations.userId, schema.users.id)
    )

    .leftJoin(
      schema.eventPasses,
      sql`${schema.eventPasses.userId} = ${schema.users.id}
          AND ${schema.eventPasses.eventId} = ${eventId}`
    )

    .where(eq(schema.eventRegistrations.eventId, eventId));

}


async createEventPass(eventId:number, userId:number, data:any) {

  const existing = await db
    .select()
    .from(schema.eventPasses)
    .where(
      sql`${schema.eventPasses.eventId}=${eventId}
      AND ${schema.eventPasses.userId}=${userId}`
    );

  // already has pass
  if (existing.length > 0) return;

  // normalize department
  const prefix = data.department
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  // count department-wise
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.eventPasses)
    .where(eq(schema.eventPasses.department, data.department));

  const nextNumber = String(Number(count) + 1).padStart(4, "0");

  const qrData = `${prefix}-${nextNumber}`;

  await db.insert(schema.eventPasses).values({
    eventId,
    userId,
    qrData,
    studentName: data.name,
    studentEmail: data.email,
    department: data.department
  });
}

// Get user's pass
async getUserEventPass(eventId:number, userId:number) {
  const [pass] = await db
    .select()
    .from(schema.eventPasses)
    .where(
      sql`${schema.eventPasses.eventId}=${eventId} 
      AND ${schema.eventPasses.userId}=${userId}`
    );

  return pass;
}

// Count registrations
async getEventRegistrationsCount(eventId:number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.eventId, eventId));

  return Number(count);
}

async getMaterialCategories(){
  return db.select().from(schema.materialsCategories);
}

async createMaterialCategory(data:any){
  const [created] = await db
    .insert(schema.materialsCategories)
    .values(data)
    .returning();
  return created;
}

async getMaterialSubCategories(categoryId:number){
  return db
    .select()
    .from(schema.materialsSubCategories)
    .where(eq(schema.materialsSubCategories.categoryId,categoryId));
}

async createMaterialSubCategory(data:any){
  const [created] = await db
    .insert(schema.materialsSubCategories)
    .values(data)
    .returning();
  return created;
}

async getMaterialTopics(subCategoryId:number){
  return db
    .select()
    .from(schema.materialsTopics)
    .where(eq(schema.materialsTopics.subCategoryId,subCategoryId));
}

async getMaterialTopic(id:number){
  const [topic] = await db
    .select()
    .from(schema.materialsTopics)
    .where(eq(schema.materialsTopics.id,id));
  return topic;
}

async createMaterialTopic(data:any){
  const [created] = await db
    .insert(schema.materialsTopics)
    .values(data)
    .returning();
  return created;
}



}

export const storage = new DatabaseStorage();