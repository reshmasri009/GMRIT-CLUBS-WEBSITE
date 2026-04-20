import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api as rawApi } from "@shared/routes";
import { sql } from "drizzle-orm";

import { canAccessDepartment } from "./security/access";
const api = rawApi as any;

import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { setupSocketServer } from "./services";
import { requireAuth } from "./middleware/auth";
import { requireRole } from "./middleware/roleGuard";
import multer from "multer";
import cloudinary from "./config/cloudinary";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";



const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_12345";
function generateCertificateId(
  departmentCode: string,
  eventCode: string,
  year: number,
  sequence: number
) {
  return `${year}-${eventCode}${departmentCode}-${String(sequence).padStart(3, "0")}`;
}


function generateCertificateHTML(data:{
  certificateId:string
  studentName:string
  department:string
  eventName:string
  eventDate:string
  qrImage:string
}){

return `
<html>

<head>

<style>

body{
width:1123px;
height:794px;
font-family:Arial;
border:10px solid #003366;
padding:40px;
text-align:center;
}

.title{
font-size:38px;
font-weight:bold;
}

.subtitle{
font-size:24px;
margin-top:10px;
}

.row{
display:flex;
justify-content:space-between;
margin-top:60px;
align-items:center;
}

.left{
text-align:left;
font-size:20px;
}

.qr{
text-align:right;
}

.footer{
margin-top:50px;
font-size:16px;
}

</style>

</head>

<body>

<div class="title">
GMR INSTITUTE OF TECHNOLOGY
</div>

<div class="subtitle">
CERTIFICATE OF PARTICIPATION
</div>

<div class="row">

<div class="left">

<p><b>Student Name :</b> ${data.studentName}</p>

<p><b>Certificate Number :</b> ${data.certificateId}</p>

</div>

<div class="qr">
<img src="${data.qrImage}" width="150"/>
</div>

</div>

<div style="margin-top:60px;font-size:22px">

THIS IS CERTIFIED THAT  
<b>${data.studentName}</b>  
FROM <b>${data.department}</b>  

HAS PARTICIPATED IN THE EVENT  

<b>${data.eventName}</b>

CONDUCTED ON ${data.eventDate}

THANK YOU FOR PARTICIPATING IN THIS EVENT.

FOR CERTIFICATE PLEASE SHOW THIS  
SYSTEM GENERATED CERTIFICATE  
TO CLUB ADMINS.

</div>

<div class="footer">

<b>THIS IS SYSTEM GENERATED</b>

</div>

</body>
</html>
`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      }
    } : false
  }));

  app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(
  "/",
  express.static(path.join(process.cwd(), "client/public"))
);

// 🔹 ADD THIS BLOCK HERE
app.use(
  "/certificates",
  express.static(path.join(process.cwd(), "certificates"))
);

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  });

  app.use("/api/", limiter);

  const io = setupSocketServer(httpServer);
  app.set("io", io);
  const upload = multer({ storage: multer.memoryStorage() });

  /* ---------------- AUTH ---------------- */

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);

      const existingUser = await storage.getUserByEmail(input.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);

      // ---------------- AUTO DEPARTMENT DETECTION ----------------



        let departmentId: number | null = null;

        // Step 1: get JNTU number from input OR email
        let jntu = input.jntuNumber;

        if (!jntu && input.email) {
          jntu = input.email.split("@")[0];
        }

        // Step 2: detect department from JNTU
        if (jntu && jntu.length >= 8) {

          const deptCode = jntu.substring(6,8);

          const deptMap:any = {
            "01":"CIVIL",
            "02":"EEE",
            "03":"MECH",
            "04":"ECE",
            "05":"CSE",
            "12":"IT",
            "42":"ML",
            "45":"DS"
          };

          const deptName = deptMap[deptCode];

          if (deptName) {

            const [dept] = await db
              .select()
              .from(schema.departments)
              .where(eq(schema.departments.name, deptName));

            if (dept) {
              departmentId = dept.id;
            }

          }
        }

      const user = await storage.createUser({
        ...input,
        password: hashedPassword,
        departmentId
      });

      const token = jwt.sign(
        // { id: user.id, role: user.role, departmentId: user.departmentId },
        { 
          id: user.id,
          role: user.role,
          departmentId: user.departmentId,
          clubId: user.clubId
        },

        JWT_SECRET,
        { expiresIn: "1d" }
      );
      res.cookie("accessToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        success: true,
        accessToken: token,
        refreshToken: token,
        user,
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);

      const user = await storage.getUserByEmail(input.email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const isMatch = await bcrypt.compare(input.password, user.password);
      if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign(
        // { id: user.id, role: user.role, departmentId: user.departmentId },
        { 
          id: user.id,
          role: user.role,
          departmentId: user.departmentId,
          clubId: user.clubId
        },

        JWT_SECRET,
        { expiresIn: "1d" }
      );
      res.cookie("accessToken", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      };

      res.json({
        success: true,
        accessToken: token,
        refreshToken: token,
        user: safeUser,
      });

    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.auth.me.path, requireAuth, async (req, res) => {
  const user = await storage.getUser((req as any).user.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    isVerified: user.isVerified,
    createdAt: user.createdAt
  };

  res.json(safeUser);
});


/* ✅ ADD THIS BLOCK BELOW */

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("accessToken");
  res.json({ success: true });
});

/* ---------------- PROFILE ---------------- */

// GET LOGGED-IN USER PROFILE
app.get("/api/profile", requireAuth, async (req, res) => {

  const profile = await storage.getProfileWithDepartment(
    (req as any).user.id
  );

  if (!profile) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(profile);
});


// UPDATE PROFILE
app.patch("/api/profile", requireAuth, async (req, res) => {

  const userId = (req as any).user.id;

  const { name, departmentId, jntuNumber, year, profileImage } = req.body;

  await db
    .update(schema.users)
    .set({
      name,
      departmentId,
      jntuNumber,
      year,
      profileImage
    })
    .where(eq(schema.users.id, userId));

  const updated = await storage.getUser(userId);

  res.json(updated);
});


/* ---------------- FILE UPLOAD (Cloudinary) ---------------- */

app.post(
  "/api/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // ✅ Allowed file types
      const allowedTypes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/webp",

        // Videos
        "video/mp4",
        "video/webm",
        "video/quicktime",

        // Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
      ];

      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: "File type not allowed"
        });
      }

      // ✅ Detect resource type
      let resourceType: "image" | "video" | "raw" = "image";

      if (file.mimetype.startsWith("video")) {
        resourceType = "video";
      }

      if (
        file.mimetype === "application/pdf" ||
        file.mimetype.includes("word") ||
        file.mimetype === "text/plain"
      ) {
        resourceType = "raw";
      }

      const result = await new Promise<any>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
            {
              folder: "campus_uploads",
              resource_type: resourceType,
              unique_filename: true,
              overwrite: true
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(file.buffer);
      });

      res.json({
          url: result.secure_url,
          originalName: file.originalname
        });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

  /* ---------------- ANNOUNCEMENTS ---------------- */

  app.get(api.announcements.list.path, async (req, res) => {
    res.json(await storage.getAnnouncements());
  });

  app.post(
    api.announcements.create.path,
    requireAuth,
    requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
    async (req, res) => {
      const input = api.announcements.create.input.parse(req.body);
      res.status(201).json(await storage.createAnnouncement(input));
    }
  );

  app.patch(
  "/api/announcements/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
  async (req,res)=>{

    const id = Number(req.params.id);

    const { title, content, imageUrl } = req.body;

    const [updated] = await db
      .update(schema.announcements)
      .set({
        title,
        content,
        imageUrl
      })
      .where(eq(schema.announcements.id,id))
      .returning();

    res.json(updated);

});

app.delete(
  "/api/announcements/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
  async (req,res)=>{

    const id = Number(req.params.id);

    await db
      .delete(schema.announcements)
      .where(eq(schema.announcements.id,id));

    res.json({success:true});

});

app.patch(
  "/api/announcements/:id/pin",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
  async (req,res)=>{

    const id = Number(req.params.id);

    const { pinned } = req.body;

    await db
      .update(schema.announcements)
      .set({ pinned })
      .where(eq(schema.announcements.id,id));

    res.json({success:true});

});
  /* ---------------- EVENTS ---------------- */

app.get(api.events.list.path, requireAuth, async (req, res) => {

  const user = (req as any).user;

  // STUDENT
  if (user.role === "STUDENT") {
    return res.json(await storage.getEvents());
  }

  // SUPER ADMIN
  if (user.role === "SUPER_ADMIN") {
    return res.json(await storage.getEvents());
  }

  // DEPARTMENT ADMIN
  if (user.role === "DEPARTMENT_ADMIN") {
    return res.json(
      await storage.getEventsByDepartment(user.departmentId)
    );
  }

  // CLUB ADMIN / TEAM LEAD
  if ((user.role === "CLUB_ADMIN" || user.role === "TEAM_LEAD") && user.clubId) {
    return res.json(
      await storage.getEventsByClub(user.clubId)
    );
  }

  // fallback
  return res.json(await storage.getEvents());
});

  app.post(
    api.events.create.path,
    requireAuth,
    requireRole(["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
    async (req, res) => {

      const input = api.events.create.input.parse({
        ...req.body,
        clubId: (req as any).user.clubId,
        departmentId: (req as any).user.departmentId,
        date: new Date(req.body.date),
        deadline: new Date(req.body.deadline)
      });

      res.status(201).json(await storage.createEvent(input));
    }
  );


app.post("/api/events/:id/register", requireAuth, async (req, res) => {

  const userId = (req as any).user.id;
  const eventId = Number(req.params.id);

  const { name, email, department } = req.body;

  const existingPass = await storage.getUserEventPass(eventId, userId);

  if (existingPass) {
    return res.json(existingPass);
  }

  await storage.registerForEvent(eventId, userId);

  await storage.createEventPass(eventId, userId, {
    name,
    email,
    department
  });

  const pass = await storage.getUserEventPass(eventId, userId);

  res.json(pass);

});

app.get("/api/events/:id/pass", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const eventId = Number(req.params.id);

  const pass = await storage.getUserEventPass(eventId, userId);
  res.json(pass);
});


app.get("/api/events/:id/count", requireAuth, async (req, res) => {
  const count = await storage.getEventRegistrationsCount(
    Number(req.params.id)
  );
  res.json({ count });
});

app.get("/api/events/:id/users", requireAuth, async (req, res) => {
  const users = await storage.getEventRegistrations(
    Number(req.params.id)
  );
  res.json(users);
});


app.post("/api/events/validate-pass", requireAuth, async (req,res)=>{

  const { qrData, eventId } = req.body;

  const [pass] = await db
    .select()
    .from(schema.eventPasses)
    .where(
      sql`${schema.eventPasses.qrData}=${qrData}
      AND ${schema.eventPasses.eventId}=${eventId}`
    );

  if(!pass){
    return res.status(404).json({
      message:"Invalid QR"
    });
  }

  if(pass.validated){
    return res.json({
      message:"Already validated",
      pass
    });
  }

  await db
    .update(schema.eventPasses)
    .set({
      validated:true,
      validatedAt:new Date()
    })
    .where(eq(schema.eventPasses.id,pass.id));

  res.json({
    success:true,
    message:"Pass validated",
    student:pass.studentName
  });

});

// ---------------- CLUBS ----------------

// Get all clubs
app.get("/api/clubs", requireAuth, async (req, res) => {

  const user = (req as any).user;
  const userId = user.id;

  let clubs;

  if (user.role === "SUPER_ADMIN") {

    clubs = await db.select().from(schema.clubs);

  } else {

    clubs = await db
      .select()
      .from(schema.clubs)
      .where(
        sql`${schema.clubs.departmentId} = ${user.departmentId}
        OR ${schema.clubs.departmentId} IS NULL`
      );

  }

  const memberships = await db
    .select()
    .from(schema.clubMembers)
    .where(eq(schema.clubMembers.userId, userId));

  const joinedClubIds = memberships.map(m => m.clubId);

  const result = await Promise.all(
    clubs.map(async (club) => {

      const members = await db
        .select()
        .from(schema.clubMembers)
        .where(eq(schema.clubMembers.clubId, club.id));

      return {
        ...club,
        joined: joinedClubIds.includes(club.id),
        memberCount: members.length
      };

    })
  );

  res.json(result);

});

// Create club (ADMIN)
app.post(
  "/api/clubs",
  requireAuth,
  requireRole(["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {

    const user = (req as any).user;

    const { name, description, logo, departmentId } = req.body;

    let deptId = departmentId;

    // Force department for non super admin
    if (user.role !== "SUPER_ADMIN") {
      deptId = user.departmentId;
    }

    const [club] = await db
      .insert(schema.clubs)
      .values({
        name,
        description,
        logo,
        departmentId: deptId
      })
      .returning();

    res.status(201).json(club);
  }
);

/* ---------------- EDIT CLUB ---------------- */

app.patch(
  "/api/clubs/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN"]),
  async (req,res)=>{

    const id = Number(req.params.id);

    const { name, description, logo } = req.body;

    await db
      .update(schema.clubs)
      .set({
        name,
        description,
        logo
      })
      .where(eq(schema.clubs.id,id));

    res.json({success:true});

});

// Register student to club
// Register student to club
app.post("/api/clubs/:id/register", requireAuth, async (req, res) => {

  const clubId = Number(req.params.id);
  const userId = (req as any).user.id;

  const [club] = await db
    .select()
    .from(schema.clubs)
    .where(eq(schema.clubs.id, clubId));

  const members = await db
    .select()
    .from(schema.clubMembers)
    .where(eq(schema.clubMembers.clubId, clubId));

  if (club.maxMembers && members.length >= club.maxMembers) {
    return res.status(400).json({
      message: "Club is full"
    });
  }

  const existing = await db
    .select()
    .from(schema.clubMembers)
    .where(
      sql`${schema.clubMembers.clubId} = ${clubId}
      AND ${schema.clubMembers.userId} = ${userId}`
    );

  if (existing.length) {
    return res.status(400).json({
      message: "Already joined club"
    });
  }

  await db.insert(schema.clubMembers).values({
    clubId,
    userId,
    role: "MEMBER"
  });

  await db
    .update(schema.users)
    .set({ clubId })
    .where(eq(schema.users.id, userId));

  res.json({ success: true });

});


app.delete("/api/clubs/:id/leave", requireAuth, async (req,res)=>{

  const clubId = Number(req.params.id);
  const userId = (req as any).user.id;

  await db
    .delete(schema.clubMembers)
    .where(
      sql`${schema.clubMembers.clubId}=${clubId}
      AND ${schema.clubMembers.userId}=${userId}`
    );

  await db
    .update(schema.users)
    .set({ clubId: null })
    .where(eq(schema.users.id,userId));

  res.json({success:true});

});

// Get club details
app.get("/api/clubs/:id", requireAuth, async (req, res) => {

  const clubId = Number(req.params.id);

  // CLUB INFO
  const [club] = await db
    .select()
    .from(schema.clubs)
    .where(eq(schema.clubs.id, clubId));

  // CLUB LEADERS (ONLY ADMIN + TEAM LEAD)
  const leaders = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      phone: schema.users.jntuNumber,
      role: schema.clubMembers.role
    })
    .from(schema.clubMembers)
    .leftJoin(schema.users, eq(schema.clubMembers.userId, schema.users.id))
    .where(
      sql`${schema.clubMembers.clubId} = ${clubId}
      AND (${schema.clubMembers.role} = 'CLUB_ADMIN'
      OR ${schema.clubMembers.role} = 'TEAM_LEAD')`
    );

  // CLUB UPDATES (POSTED BY CLUB MEMBERS)
  const updates = await db
  .select({
    id: schema.feedPosts.id,
    caption: schema.feedPosts.caption,
    mediaUrl: schema.feedPosts.mediaUrl,
    createdAt: schema.feedPosts.createdAt,
    authorName: schema.users.name
  })
  .from(schema.feedPosts)
  .leftJoin(schema.users, eq(schema.feedPosts.authorId, schema.users.id))
  .where(eq(schema.feedPosts.clubId, clubId));

  res.json({
    club,
    leaders,
    updates
  });

});

/* ---------------- CLUB MEMBERS ---------------- */

app.get(
  "/api/clubs/:id/members",
  requireAuth,
  async (req,res)=>{

    const clubId = Number(req.params.id);

    const members = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.clubMembers.role
      })
      .from(schema.clubMembers)
      .leftJoin(
        schema.users,
        eq(schema.clubMembers.userId, schema.users.id)
      )
      .where(eq(schema.clubMembers.clubId,clubId));

    res.json(members);

});


app.post(
  "/api/clubs/:id/leader",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN"]),
  async (req,res)=>{

    const clubId = Number(req.params.id);
    const { email, role } = req.body;

    const user = await storage.getUserByEmail(email);

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    // Check if already member
    const existing = await db
      .select()
      .from(schema.clubMembers)
      .where(
        sql`${schema.clubMembers.clubId}=${clubId}
        AND ${schema.clubMembers.userId}=${user.id}`
      );

    if(existing.length){

      // update role instead of inserting
      await db
        .update(schema.clubMembers)
        .set({ role })
        .where(eq(schema.clubMembers.id, existing[0].id));

    } else {

      // insert new member
      await db.insert(schema.clubMembers).values({
        clubId,
        userId: user.id,
        role
      });

    }

    // update user's club
    await db
      .update(schema.users)
      .set({ clubId })
      .where(eq(schema.users.id, user.id));

    res.json({success:true});
});


app.post(
  "/api/clubs/:id/update",
  requireAuth,
  requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
  async (req,res)=>{

    const clubId = Number(req.params.id);
    const { caption, mediaUrl } = req.body;
    const post = await db.insert(schema.feedPosts).values({
      caption,
      mediaUrl,
      clubId,
      authorId: (req as any).user.id,
      createdAt: new Date()
    }).returning();

    res.json(post[0]);
});


app.get("/api/users/search", requireAuth, async (req,res)=>{

  const q = String(req.query.q || "");
  const user = (req as any).user;

  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email
    })
    .from(schema.users)
    .where(
      sql`${schema.users.email} ILIKE ${"%" + q + "%"}
      AND ${schema.users.departmentId} = ${user.departmentId}`
    )
    .limit(10);

  res.json(users);

});

app.delete(
  "/api/clubs/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const id = Number(req.params.id);

    await db
      .delete(schema.clubs)
      .where(eq(schema.clubs.id,id));

    res.json({success:true});
});

// ================= MY REGISTERED EVENTS =================

app.get("/api/events/my", requireAuth, async (req, res) => {

  const userId = (req as any).user.id;

  const events = await storage.getEvents();

  const registered = [];

  for (const ev of events) {
    const pass = await storage.getUserEventPass(ev.id, userId);
    if (pass) {
      registered.push(ev);
    }
  }

  res.json(registered);
});



  /* ---------------- FEED ---------------- */

  // app.get(api.feed.list.path, async (req, res) => {
  //   res.json(await storage.getFeedPosts());
  // });

  // app.post(
  //   api.feed.create.path,
  //   requireAuth,
  //   requireRole(["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
  //   async (req, res) => {

  //     const input = api.feed.create.input.parse({
  //       ...req.body,
  //       authorId: (req as any).user.id
  //         })
  //     res.status(201).json(await storage.createFeedPost(input));
  //   }
  // );

  /* ---------------- FEED ---------------- */

// LIST + PAGINATION
app.get(api.feed.list.path, async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = 8;
  const offset = (page - 1) * limit;

  res.json(await storage.getFeedPosts(limit, offset));
});

// CREATE
app.post(
  api.feed.create.path,
  requireAuth,
  requireRole(["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {
    const input = api.feed.create.input.parse({
      ...req.body,
      authorId: (req as any).user.id,
      clubId: (req as any).user.clubId
    });

    res.status(201).json(await storage.createFeedPost(input));
  }
);

// LIKE
app.post("/api/feed/:id/like", requireAuth, async (req, res) => {
  await storage.likeFeedPost(Number(req.params.id));
  res.json({ success: true });
});

// DELETE
app.delete("/api/feed/:id", requireAuth, async (req, res) => {
  await storage.deleteFeedPost(Number(req.params.id));
  res.json({ success: true });
});

// EDIT
app.patch("/api/feed/:id", requireAuth, async (req, res) => {
  const { caption } = req.body;
  res.json(
    await storage.updateFeedPost(Number(req.params.id), { caption })
  );
});

  /* ---------------- COMPANIES ---------------- */

  app.get(api.companies.list.path, async (req, res) => {
    res.json(await storage.getCompanies());
  });

  app.post(
    api.companies.create.path,
    requireAuth,
    requireRole(["SUPER_ADMIN"]),
    async (req, res) => {

      const input = api.companies.create.input.parse(req.body);
      res.status(201).json(await storage.createCompany(input));
    }
  );

  /* ---------------- MATERIALS ---------------- */

app.get(api.materials.list.path, requireAuth, async (req, res) => {

  const user = (req as any).user;

  if(user.role === "SUPER_ADMIN"){
    return res.json(await storage.getMaterials());
  }

  const materials = await db
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.departmentId, user.departmentId));

  res.json(materials);
});

  app.post(
    api.materials.create.path,
    requireAuth,
    requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
    async (req, res) => {

      const input = api.materials.create.input.parse(req.body);
      res.status(201).json(await storage.createMaterial(input));
    }
  );


  app.get("/api/materials/categories", async (req,res)=>{
  res.json(await storage.getMaterialCategories());
})

app.post("/api/admin/materials/category",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

  const { name } = req.body;

  res.json(
    await storage.createMaterialCategory({name})
  )

})

app.get("/api/materials/subcategories/:id", async (req,res)=>{

  const categoryId = Number(req.params.id);

  res.json(
    await storage.getMaterialSubCategories(categoryId)
  )

})

app.post("/api/admin/materials/subcategory",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

  const { categoryId, name } = req.body;

  res.json(
    await storage.createMaterialSubCategory({
      categoryId,
      name
    })
  )

})


app.get("/api/materials/topics/:id", async (req,res)=>{

  const subCategoryId = Number(req.params.id);

  res.json(
    await storage.getMaterialTopics(subCategoryId)
  )

})

app.get("/api/materials/topic/:id", async (req,res)=>{

  const id = Number(req.params.id);

  res.json(
    await storage.getMaterialTopic(id)
  )

})

app.post("/api/admin/materials/topic",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

  res.json(
    await storage.createMaterialTopic(req.body)
  )

})

app.get("/api/materials/:id", requireAuth, async (req,res)=>{

  const id = Number(req.params.id);

  const topic = await db
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.id,id));

  if(!topic.length){
    return res.status(404).json({message:"Topic not found"});
  }

  res.json(topic[0]);

});


// app.delete(
// "/api/admin/materials/category/:id",
// requireAuth,
// requireRole(["SUPER_ADMIN"]),
// async (req,res)=>{

// const id = Number(req.params.id);

// await db
// .delete(schema.materialsCategories)
// .where(eq(schema.materialsCategories.id,id));

// res.json({success:true});

// });


app.delete(
"/api/admin/materials/category/:id",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

const categoryId = Number(req.params.id);

/* delete topics */

await db.execute(sql`
DELETE FROM materials_topics
WHERE sub_category_id IN (
SELECT id FROM materials_subcategories
WHERE category_id = ${categoryId}
)
`);

/* delete subcategories */

await db.execute(sql`
DELETE FROM materials_subcategories
WHERE category_id = ${categoryId}
`);

/* delete category */

await db
.delete(schema.materialsCategories)
.where(eq(schema.materialsCategories.id,categoryId));

res.json({success:true});

});



// app.delete(
// "/api/admin/materials/subcategory/:id",
// requireAuth,
// requireRole(["SUPER_ADMIN"]),
// async (req,res)=>{

// const id = Number(req.params.id);

// await db
// .delete(schema.materialsSubCategories)
// .where(eq(schema.materialsSubCategories.id,id));

// res.json({success:true});

// });

app.delete(
"/api/admin/materials/subcategory/:id",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

const subCategoryId = Number(req.params.id);

/* delete topics */

await db.execute(sql`
DELETE FROM materials_topics
WHERE sub_category_id = ${subCategoryId}
`);

/* delete subcategory */

await db
.delete(schema.materialsSubCategories)
.where(eq(schema.materialsSubCategories.id,subCategoryId));

res.json({success:true});

});



// app.delete(
// "/api/admin/materials/topic/:id",
// requireAuth,
// requireRole(["SUPER_ADMIN"]),
// async (req,res)=>{

// const id = Number(req.params.id);

// await db
// .delete(schema.materialsTopics)
// .where(eq(schema.materialsTopics.id,id));

// res.json({success:true});

// });


app.delete(
"/api/admin/materials/topic/:id",
requireAuth,
requireRole(["SUPER_ADMIN"]),
async (req,res)=>{

const id = Number(req.params.id);

await db
.delete(schema.materialsTopics)
.where(eq(schema.materialsTopics.id,id));

res.json({success:true});

});


  /* ---------------- PLACEMENTS ---------------- */

app.get(api.placements.list.path, requireAuth, async (req, res) => {

  const authUser = (req as any).user;
  const user = await storage.getUser(authUser.id);

  if (!user) {
    return res.json([]);
  }

  // ✅ SUPER_ADMIN → see ALL placements
  if (user.role === "SUPER_ADMIN") {
    const allPlacements = await db.select().from(schema.placements);
    return res.json(allPlacements);
  }

  // ✅ If user has department → filter by department
  if (user.departmentId) {
    return res.json(
      await storage.getPlacementsByDepartment(user.departmentId)
    );
  }

  return res.json([]);
});

app.post(
  api.placements.create.path,
  requireAuth,
  requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {

    const user = (req as any).user;

    let departmentId: number | null = null;

    // ✅ Department admin → use their department
    if (user.departmentId) {
      departmentId = user.departmentId;
    }

    // ✅ Super admin must send departmentId manually
    if (user.role === "SUPER_ADMIN") {
      departmentId = Number(req.body.departmentId);
    }

    if (!departmentId) {
      return res.status(400).json({
        message: "Department ID required"
      });
    }

    const input = api.placements.create.input.parse({
      ...req.body,
      departmentId
    });

    res.status(201).json(
      await storage.createPlacement(input)
    );
  }
);


app.delete("/api/placements/:id",
  requireAuth,
  async (req, res) => {

    const user = (req as any).user;
    const id = Number(req.params.id);

    const placement = await db
      .select()
      .from(schema.placements)
      .where(eq(schema.placements.id, id));

    if (!placement.length) {
      return res.status(404).json({ message: "Placement not found" });
    }

    const p = placement[0];

    // SUPER ADMIN → can delete anything
    if (user.role === "SUPER_ADMIN") {
      await db.delete(schema.placements)
        .where(eq(schema.placements.id, id));
      return res.json({ success: true });
    }

    // Department admin → only their department
    if(await canAccessDepartment(user.id, p.departmentId)){
      await db.delete(schema.placements)
        .where(eq(schema.placements.id, id));
      return res.json({ success: true });
    }

    return res.status(403).json({ message: "Forbidden" });
  }
);

app.get("/api/placements/:id", requireAuth, async (req, res) => {

  const id = Number(req.params.id);

  const placement = await db
    .select()
    .from(schema.placements)
    .where(eq(schema.placements.id, id));

  if (!placement.length) {
    return res.status(404).json({ message: "Placement not found" });
  }

  res.json(placement[0]);

});

  /* ---------------- RESULTS ---------------- */

  app.get(api.results.list.path, requireAuth, async (req, res) => {

  const user = (req as any).user;

  // SUPER ADMIN → see all
  if (user.role === "SUPER_ADMIN") {
    return res.json(await storage.getResults());
  }

  // CLUB ADMIN / TEAM LEAD → only their club
  if (user.role === "CLUB_ADMIN" || user.role === "TEAM_LEAD") {
    return res.json(
      await storage.getResultsByClub(user.clubId)
    );
  }

  // STUDENT → see all
  return res.json(await storage.getResults());
});

app.post(
  "/api/results",
  requireAuth,
  requireRole(["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {

    const { eventId, resultType, teamName, participants } = req.body;

    // 1️⃣ Create result
    const [result] = await db
      .insert(schema.results)
      .values({
        eventId,
        resultType,
        teamName: teamName || null
      })
      .returning();

    // 2️⃣ Insert participants
    for (const p of participants) {

      const badge =
        p.position === 1 ? "Gold" :
        p.position === 2 ? "Silver" :
        p.position === 3 ? "Bronze" :
        null;

      await db.insert(schema.resultParticipants).values({
        resultId: result.id,
        name: p.name,
        jntuNumber: p.jntuNumber,
        email: p.email,
        department: p.department,
        position: p.position,
        badge
      });

    }

    res.status(201).json({ success: true });

  }
);

app.delete(
"/api/results/:id",
requireAuth,
requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD"]),
async(req,res)=>{

  const id = Number(req.params.id);
  await db
  .delete(schema.resultParticipants)
  .where(eq(schema.resultParticipants.resultId,id));

await db
  .delete(schema.results)
  .where(eq(schema.results.id,id));

  res.json({success:true});

});


/* ---------------- CERTIFICATIONS ---------------- */


app.post(
"/api/events/:id/generate-certificates",
requireAuth,
requireRole(["SUPER_ADMIN","CLUB_ADMIN","TEAM_LEAD","DEPARTMENT_ADMIN"]),
async (req,res)=>{

try{

const eventId = Number(req.params.id)

const [event] = await db
.select()
.from(schema.events)
.where(eq(schema.events.id,eventId))

if(!event){
return res.status(404).json({message:"Event not found"})
}

// ONLY VALIDATED STUDENTS
const students = await db
.select({
userId:schema.users.id,
name:schema.users.name,
department:schema.eventPasses.department,
qrData:schema.eventPasses.qrData
})
.from(schema.eventPasses)
.leftJoin(
schema.users,
eq(schema.eventPasses.userId,schema.users.id)
)
.where(
sql`${schema.eventPasses.eventId}=${eventId}
AND ${schema.eventPasses.validated}=true`
)

if(!students.length){
return res.status(400).json({message:"No validated students"})
}

const browser = await puppeteer.launch({
headless:true,
args:["--no-sandbox"]
})

let sequence = 1

for(const student of students){

const page = await browser.newPage()

const certificateId = `EVT-${eventId}-${sequence++}`

// generate QR image
const qrImage = await QRCode.toDataURL(student.qrData as string)

const html = generateCertificateHTML({

certificateId,
studentName: student.name!,
department: student.department!,
eventName: event.title,
eventDate: new Date(event.date).toDateString(),
qrImage

})

await page.setViewport({
width:1123,
height:794
})

await page.setContent(html)

const pdfBuffer = await page.pdf({
format:"A4",
landscape:true,
printBackground:true
})

const folder = path.join(process.cwd(),"certificates")

if(!fs.existsSync(folder)){
fs.mkdirSync(folder)
}

const filePath = path.join(folder,`${certificateId}.pdf`)

fs.writeFileSync(filePath,pdfBuffer)

await db.insert(schema.certificates).values({

userId: student.userId!,
eventId: eventId,
title: event.title,
certificatePdf:`/certificates/${certificateId}.pdf`,
issuedBy:(req as any).user.id

})

await page.close()

}

await browser.close()

res.json({
success:true,
message:"Certificates generated"
})

}catch(err){

console.error(err)

res.status(500).json({
message:"Certificate generation failed"
})

}

})

// ✅ Admin uploads certificate for a student
app.post(
  "/api/certificates",
  requireAuth,
  requireRole(["CLUB_ADMIN", "TEAM_LEAD", "SUPER_ADMIN"]),
  async (req, res) => {

    const { email, certificatePdf, title } = req.body;

    if (!email || !certificatePdf) {
      return res.status(400).json({ message: "Email and certificate required" });
    }

    const student = await storage.getUserByEmail(email);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await db.insert(schema.certificates).values({
      userId: student.id,
      title: title || "Certificate",
      certificatePdf,
      eventId: null,
      issuedBy: (req as any).user.id
    });

    res.json({ success: true });
  }
);

// ✅ Admin - Get all certificates
app.get(
  "/api/admin/certificates",
  requireAuth,
  requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN","CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {

    const certificates = await db
      .select()
      .from(schema.certificates);

    res.json(certificates);
  }
);



// ✅ Delete Certificate (Fixed Cloudinary logic)
app.delete(
  "/api/certificates/:id",
  requireAuth,
  requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN","CLUB_ADMIN", "TEAM_LEAD"]),
  async (req, res) => {

    const certId = Number(req.params.id);

    const certificate = await db
      .select()
      .from(schema.certificates)
      .where(eq(schema.certificates.id, certId));

    if (!certificate.length) {
      return res.status(404).json({
        message: "Certificate not found"
      });
    }

    const cert = certificate[0];

    // 🔥 Correct Cloudinary public_id extraction
    try {
      if (cert.certificatePdf) {

        const url = new URL(cert.certificatePdf);
        const pathname = url.pathname;

        const uploadIndex = pathname.indexOf("/upload/");
        const publicIdWithVersion = pathname.substring(uploadIndex + 8);

        const publicId = publicIdWithVersion
          .replace(/v\d+\//, "")
          .replace(/\.[^/.]+$/, "");

        await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });
      }

    } catch (err) {
      console.error("Cloudinary delete failed (continuing)");
    }

    await db
      .delete(schema.certificates)
      .where(eq(schema.certificates.id, certId));

    res.json({ success: true });
  }
);


// ✅ Logged-in student sees their certificates
app.get(
  "/api/my-certificates",
  requireAuth,
  async (req, res) => {

    const userId = (req as any).user.id;

    const certificates = await db
      .select()
      .from(schema.certificates)
      .where(eq(schema.certificates.userId, userId));

    res.json(certificates);
  }
);


// app.post(
//   "/api/admin/certificates/bulk-generate",
//   requireAuth,
//   requireRole([
//   "SUPER_ADMIN",
//   "DEPARTMENT_ADMIN",
//   "CLUB_ADMIN",
//   "TEAM_LEAD"
// ]),
//   async (req, res) => {

//     try {

//       // ✅ FIXED: Remove students from destructuring
//       const {
//         eventName,
//         eventCode,
//         departmentCode,
//         departmentName,
//         eventDate,
//         year
//       } = req.body;

//       // ✅ Parse CSV text from frontend
//       let students: any[] = [];

//       if (typeof req.body.students === "string") {

//         const lines = req.body.students
//           .split("\n")
//           .map((l: string) => l.trim())
//           .filter(Boolean);

//         if (lines.length < 2) {
//           return res.status(400).json({
//             message: "Invalid CSV format"
//           });
//         }

//         // Skip header row
//         for (let i = 1; i < lines.length; i++) {

//           const [name, email, department, studentYear] =
//             lines[i].split(",");

//           students.push({
//             name: name?.trim(),
//             email: email?.trim(),
//             department: department?.trim(),
//             year: studentYear?.trim()
//           });
//         }

//       } else {
//         return res.status(400).json({
//           message: "Students must be CSV text"
//         });
//       }

//       if (!students.length) {
//         return res.status(400).json({
//           message: "No valid students found"
//         });
//       }

//       // ✅ Validate departmentCode
//       if (!departmentCode) {
//         return res.status(400).json({
//           message: "Department Code required (CSE/ECE/etc)"
//         });
//       }

//       // ✅ Find department from DB
//         const [department] = await db
//           .select()
//           .from(schema.departments)
//           .where(sql`LOWER(${schema.departments.name}) = LOWER(${departmentCode})`);

//       if (!department) {
//         return res.status(400).json({
//           message: "Invalid Department Code"
//         });
//       }

//       const departmentId = department.id;

//       // ✅ Fetch department template
//       const [deptTemplate] = await db
//         .select()
//         .from(schema.departmentTemplates)
//         .where(eq(schema.departmentTemplates.departmentId, departmentId));

//       const browser = await puppeteer.launch({
//         headless: true,
//         args: ["--no-sandbox", "--disable-setuid-sandbox"]
//       });

//       const page = await browser.newPage();

//       let sequence = 1;

//       for (const student of students) {

//         const certificateId = generateCertificateId(
//           departmentCode,
//           eventCode,
//           year,
//           sequence++
//         );

//         let html;

//         // ✅ Use Department Template if exists
//         if (deptTemplate) {

//           html = deptTemplate.templateHtml
//             .replace(/{{CERTIFICATE_ID}}/g, certificateId)
//             .replace(/{{STUDENT_NAME}}/g, student.name)
//             .replace(/{{DEPARTMENT}}/g, student.department)
//             .replace(/{{YEAR}}/g, student.year)
//             .replace(/{{EVENT_NAME}}/g, eventName)
//             .replace(/{{DEPARTMENT_NAME}}/g, departmentName)
//             .replace(/{{EVENT_DATE}}/g, eventDate);

//         } else {

//           html = generateCertificateHTML({
//             logoUrl: "http://localhost:5000/GMRLogo.png",
//             certificateId,
//             studentName: student.name,
//             department: student.department,
//             academicYear: student.year,
//             eventName,
//             departmentName,
//             eventDate
//           });

//         }

//         await page.setViewport({
//           width: 1123,
//           height: 794
//         });

//         await page.setContent(html, {
//           waitUntil: "networkidle0"
//         });

//         await page.evaluate(() => document.fonts.ready);

//         const pdfBuffer = await page.pdf({
//           format: "A4",
//           landscape: true,
//           printBackground: true,
//           margin: {
//             top: "0px",
//             right: "0px",
//             bottom: "0px",
//             left: "0px"
//           }
//         });

//         // ✅ Upload to Cloudinary
//                         const result = await new Promise<any>((resolve, reject) => {
//                           cloudinary.uploader.upload_stream(
//                             {
//                               folder: "certificates",
//                               resource_type: "auto",
//                               format: "pdf",
//                               public_id: `certificate_${certificateId}`,
//                               overwrite: true
//                             },
//                             (err, result) => {
//                               if (err) reject(err);
//                               else resolve(result);
//                             }
//                           ).end(pdfBuffer);
//                         });

//         // ✅ Save certificate to student
//         const user = await storage.getUserByEmail(student.email);

//         if (user) {
//           await db.insert(schema.certificates).values({
//             userId: user.id,
//             title: eventName,
//             certificatePdf: result.secure_url,
//             issuedBy: (req as any).user.id
//           });
//         }
//       }

//       await browser.close();

//       res.json({ success: true });

//     } catch (error) {
//       console.error(error);
//       res.status(500).json({
//         message: "Certificate generation failed"
//       });
//     }
//   }
// );


/* ---------------- DEPARTMENT TEMPLATE ---------------- */

// app.post(
//   "/api/admin/certificate-template",
//   requireAuth,
//   requireRole(["SUPER_ADMIN", "DEPARTMENT_ADMIN"]),
//   async (req, res) => {

//     try {

//       const { templateHtml, departmentCode } = req.body;

//       if (!templateHtml || !departmentCode) {
//         return res.status(400).json({
//           message: "Template HTML and Department Code required"
//         });
//       }

//       // Find department
//       const [department] = await db
//         .select()
//         .from(schema.departments)
//         .where(sql`LOWER(${schema.departments.name}) = LOWER(${departmentCode})`);

//       if (!department) {
//         return res.status(400).json({
//           message: "Invalid Department Code"
//         });
//       }

//       const departmentId = department.id;

//       // delete old template
//       await db
//         .delete(schema.departmentTemplates)
//         .where(eq(schema.departmentTemplates.departmentId, departmentId));

//       // insert new template
//       await db.insert(schema.departmentTemplates).values({
//         departmentId,
//         templateHtml,
//         createdBy: (req as any).user.id
//       });

//       res.json({ success: true });

//     } catch (error) {

//       console.error("Template save error:", error);

//       res.status(500).json({
//         message: "Template save failed"
//       });

//     }

//   }
// );

/* ---------------- USER MANAGEMENT ---------------- */

app.get("/api/admin/users", requireAuth, async (req, res) => {
  const { departmentId, clubId } = req.query;
  const user = (req as any).user;

  let users = [];

  // SUPER ADMIN → all users
  if (user.role === "SUPER_ADMIN") {
    users = await storage.getAllUsers();
  }

  // DEPARTMENT ADMIN → only their department
  else if (user.role === "DEPARTMENT_ADMIN") {
    users = await storage.getUsersByDepartment(user.departmentId);
  }

  // CLUB ADMIN / TEAM LEAD → only their club
  else if (user.role === "CLUB_ADMIN" || user.role === "TEAM_LEAD") {
    users = await storage.getUsersByClub(user.clubId);
  }

  else {
    return res.status(403).json({ message: "Forbidden" });
  }

  // 🔍 Apply optional filters from UI
  if (departmentId) {
    users = users.filter(
      (u: any) => u.departmentId == Number(departmentId)
    );
  }

  if (clubId) {
    users = users.filter(
      (u: any) => u.clubId == Number(clubId)
    );
  }

  res.json(users);
});



/* ---------------- UPDATE USER ROLE ---------------- */

app.patch(
  "/api/admin/users/:id/role",
  requireAuth,
  requireRole(["SUPER_ADMIN","DEPARTMENT_ADMIN"]),
  async (req, res) => {

    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: "Role is required" });
    }

    const updated = await db
      .update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, userId))
      .returning();

    res.json({
      success: true,
      user: updated[0]
    });

  }
);

app.get("/api/departments", requireAuth, async (req, res) => {
  const departments = await db.select().from(schema.departments);
  res.json(departments);
});

/* ---------------- ADMIN DASHBOARD ANALYTICS ---------------- */

// app.get("/api/admin/department-analytics", requireAuth, async (req, res) => {

//   const user = (req as any).user;

//   if (!user.departmentId) {
//     return res.status(400).json({ message: "User department not found" });
//   }

//   const departmentId = user.departmentId;

//   // total clubs in department
//   const clubs = await db
//     .select()
//     .from(schema.clubs)
//     .where(eq(schema.clubs.departmentId, departmentId));

//   // total students in department
//   const students = await db
//     .select()
//     .from(schema.users)
//     .where(eq(schema.users.departmentId, departmentId));

//   // club members
//   const clubMembers = await db
//     .select()
//     .from(schema.clubMembers);

//   const clubIds = clubs.map(c => c.id);

//   const enrolledStudents = clubMembers.filter(cm =>
//     clubIds.includes(cm.clubId)
//   );

//   res.json({
//     clubs: clubs.length,
//     students: students.length,
//     enrolledStudents: enrolledStudents.length,
//     activeMembers: enrolledStudents.length
//   });

// });

app.get("/api/admin/department-analytics", requireAuth, async (req, res) => {

  const user = (req as any).user;

  let departmentId = user.departmentId;

  // SUPER ADMIN can pass departmentId via query
  if (user.role === "SUPER_ADMIN") {
    departmentId = Number(req.query.departmentId);

    if (!departmentId) {
      return res.status(400).json({
        message: "DepartmentId required for super admin"
      });
    }
  }

  const clubs = await db
    .select()
    .from(schema.clubs)
    .where(eq(schema.clubs.departmentId, departmentId));

  const students = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.departmentId, departmentId));

  const clubMembers = await db
    .select()
    .from(schema.clubMembers);

  const clubIds = clubs.map(c => c.id);

  const enrolledStudents = clubMembers.filter(cm =>
    clubIds.includes(cm.clubId)
  );

  res.json({
    clubs: clubs.length,
    students: students.length,
    enrolledStudents: enrolledStudents.length,
    activeMembers: enrolledStudents.length
  });

});

/* ---------------- SUPPORT CHAT ---------------- */

// Student creates query
app.post("/api/support/session", requireAuth, async (req,res)=>{

  const user = (req as any).user;

  const { name, department, year, query } = req.body;

  // check existing session
  const existing = await storage.getStudentSession(user.id);

  if(existing){
    return res.json(existing);
  }

  const session = await storage.createSupportSession({
    studentId:user.id,
    studentName:name,
    department,
    year,
    query,
    status:"WAITING"
  });

  res.json(session);

});


app.get("/api/support/my-session", requireAuth, async (req,res)=>{

  const user = (req as any).user;

  const session = await storage.getStudentSession(user.id);

  if(!session){
    return res.json(null);
  }

  if(session.assignedTo){

    const agent = await storage.getUser(session.assignedTo);

    return res.json({
      ...session,
      agentName:agent?.name
    });

  }

  res.json(session);

});


// waiting queries
app.get("/api/support/waiting", requireAuth, async (req,res)=>{

  const sessions = await storage.getWaitingSessions();

  res.json(sessions);

});

// active chats for admin
app.get("/api/support/active", requireAuth, async (req,res)=>{

  const sessions = await storage.getAgentSessions(
    (req as any).user.id
  );

  res.json(sessions);

});


// admin accept chat
app.post("/api/support/assign", requireAuth, async (req,res)=>{

  const { sessionId } = req.body;

  await storage.assignSupportAgent(
    sessionId,
    (req as any).user.id
  );

  const io = (req.app as any).get("io");

if(io){
  io.to(`support_${sessionId}`).emit("agent_joined",{
    agentName: (req as any).user.name
  });
}

res.json({success:true});

});


// send message
app.post("/api/support/message", requireAuth, async (req,res)=>{

  const { sessionId, message, sender, fileUrl } = req.body;
  
  const msg = await storage.sendSupportMessage({
  sessionId,
  senderId:(req as any).user.id,
  senderRole: sender,
  message,
  fileUrl
  });

  // 🔴 ADD THIS BLOCK
  const io = (req.app as any).get("io");

  if(io){
      io.to(`support_${sessionId}`).emit("support_message", {
        sessionId,
        message,
        senderId:(req as any).user.id,
        senderName:(req as any).user.name
      });
  }

  res.json(msg);

});


// get messages
app.get("/api/support/messages/:id", requireAuth, async (req,res)=>{

  const sessionId = Number(req.params.id);

  const messages = await storage.getSupportMessages(sessionId);

  res.json(messages);

});

/* ---------------- ADMIN STUDENT LIST ---------------- */

// app.get("/api/admin/department-students", requireAuth, async (req, res) => {

//   const user = (req as any).user;

//   if (!user.departmentId) {
//     return res.status(400).json({ message: "Department not found" });
//   }

//   const students = await db
//     .select({
//       id: schema.users.id,
//       name: schema.users.name,
//       email: schema.users.email,
//       phone: schema.users.jntuNumber
//     })
//     .from(schema.users)
//     .where(eq(schema.users.departmentId, user.departmentId));

//   const clubData = await db
//     .select({
//       userId: schema.clubMembers.userId,
//       clubName: schema.clubs.name
//     })
//     .from(schema.clubMembers)
//     .leftJoin(schema.clubs, eq(schema.clubMembers.clubId, schema.clubs.id));

//   const result = students.map(student => {

//     const clubs = clubData
//       .filter(c => c.userId === student.id)
//       .map(c => c.clubName);

//     return {
//       ...student,
//       clubs
//     };

//   });

//   res.json(result);

// });

app.get("/api/admin/department-students", requireAuth, async (req, res) => {

  const user = (req as any).user;

  let departmentId = user.departmentId;

  if (user.role === "SUPER_ADMIN") {
    departmentId = Number(req.query.departmentId);

    if (!departmentId) {
      return res.status(400).json({
        message: "DepartmentId required"
      });
    }
  }

  const students = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.jntuNumber
    })
    .from(schema.users)
    .where(eq(schema.users.departmentId, departmentId));

  const clubData = await db
    .select({
      userId: schema.clubMembers.userId,
      clubName: schema.clubs.name
    })
    .from(schema.clubMembers)
    .leftJoin(schema.clubs, eq(schema.clubMembers.clubId, schema.clubs.id));

  const result = students.map(student => {

    const clubs = clubData
      .filter(c => c.userId === student.id)
      .map(c => c.clubName);

    return {
      ...student,
      clubs
    };

  });

  res.json(result);

});

/* ---------------- PLACEMENT PREPARATION ---------------- */

/* CODING QUESTIONS */

app.get("/api/coding-questions", requireAuth, async (req,res)=>{

  const questions = await db
    .select()
    .from(schema.codingQuestions);

  res.json(questions);

});

app.post(
  "/api/admin/coding-questions",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const {
      title,
      company,
      companyLogo,
      difficulty,
      subject,
      tags,
      question,
      answer
    } = req.body;

    const [created] = await db
      .insert(schema.codingQuestions)
      .values({
        title,
        company,
        companyLogo,
        difficulty,
        subject,
        tags,
        question,
        answer
      })
      .returning();

    res.json(created);

});

/* GET SINGLE CODING QUESTION */

app.get("/api/coding-questions/:id", requireAuth, async (req,res)=>{

  const id = Number(req.params.id);

  const question = await db
    .select()
    .from(schema.codingQuestions)
    .where(eq(schema.codingQuestions.id, id));

  if(!question.length){
    return res.status(404).json({
      message:"Question not found"
    });
  }

  res.json(question[0]);

});


/* APTITUDE QUESTIONS */

app.get("/api/aptitude", requireAuth, async (req,res)=>{

  const questions = await db
    .select()
    .from(schema.aptitudeQuestions);

  res.json(questions);

});

app.post(
  "/api/admin/aptitude",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const { topic, question, answer } = req.body;

    const [created] = await db
      .insert(schema.aptitudeQuestions)
      .values({
        topic,
        question,
        answer
      })
      .returning();

    res.json(created);

});


/* REASONING */

app.get("/api/reasoning", requireAuth, async (req,res)=>{

  const questions = await db
    .select()
    .from(schema.reasoningQuestions);

  res.json(questions);

});

app.post(
  "/api/admin/reasoning",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const { topic, question, answer } = req.body;

    const [created] = await db
      .insert(schema.reasoningQuestions)
      .values({
        topic,
        question,
        answer
      })
      .returning();

    res.json(created);

});


/* VERBAL */

app.get("/api/verbal", requireAuth, async (req,res)=>{

  const questions = await db
    .select()
    .from(schema.verbalQuestions);

  res.json(questions);

});

app.post(
  "/api/admin/verbal",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const { topic, question, answer } = req.body;

    const [created] = await db
      .insert(schema.verbalQuestions)
      .values({
        topic,
        question,
        answer
      })
      .returning();

    res.json(created);

});


/* DSA TOPICS */

app.get("/api/dsa", requireAuth, async (req,res)=>{

  const topics = await db
    .select()
    .from(schema.dsaTopics);

  res.json(topics);

});

app.post(
  "/api/admin/dsa",
  requireAuth,
  requireRole(["SUPER_ADMIN"]),
  async (req,res)=>{

    const { title, explanation, importantAreas } = req.body;

    const [created] = await db
      .insert(schema.dsaTopics)
      .values({
        title,
        explanation,
        importantAreas
      })
      .returning();

    res.json(created);

});

  return httpServer;
}
