import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { v2 as cloudinary } from "cloudinary";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_12345";

/* =====================================================
   SOCKET SERVER
===================================================== */

export function setupSocketServer(httpServer: HttpServer) {

  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  /* ---------------- AUTH ---------------- */

  io.use((socket, next) => {

    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error"));
    }

    try {

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      socket.data.user = decoded;

      next();

    } catch (err) {

      next(new Error("Authentication error"));

    }

  });

  /* ---------------- CONNECTION ---------------- */

  io.on("connection", (socket) => {

    console.log("Socket connected:", socket.id);

    const user = socket.data.user;

    /* -------- NORMAL ROOM -------- */

    socket.on("join_room", (room) => {

      socket.join(room);

      console.log(`User joined room: ${room}`);

    });

    /* -------- SUPPORT CHAT ROOM -------- */

    socket.on("join_support", (sessionId: number) => {

      const room = `support_${sessionId}`;

      socket.join(room);

      console.log(`User ${user.id} joined support room: ${room}`);

    });

    /* -------- SUPPORT MESSAGE -------- */

    socket.on("support_message", (data) => {

      const room = `support_${data.sessionId}`;

      io.to(room).emit("support_message", {
        sessionId: data.sessionId,
        message: data.message,
        senderId: user.id,
        senderName: user.name
      });

    });

    /* -------- DISCONNECT -------- */

    socket.on("disconnect", () => {

      console.log("Socket disconnected:", socket.id);

    });

  });

  return io;

}


/* =====================================================
   RBAC MIDDLEWARE
===================================================== */

export function authorize(roles: string[]) {

  return (req: any, res: any, next: any) => {

    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {

      return res.status(401).json({
        message: "Unauthorized"
      });

    }

    const token = authHeader.split(" ")[1];

    try {

      const decoded = jwt.verify(token, JWT_SECRET) as any;

      req.user = decoded;

      if (!roles.includes(decoded.role)) {

        return res.status(403).json({
          message: "Forbidden"
        });

      }

      next();

    } catch (err) {

      res.status(401).json({
        message: "Invalid token"
      });

    }

  };

}


/* =====================================================
   CLOUDINARY SERVICE
===================================================== */

cloudinary.config({

  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,

  api_key: process.env.CLOUDINARY_API_KEY,

  api_secret: process.env.CLOUDINARY_API_SECRET,

});


export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string
) {

  return new Promise((resolve, reject) => {

    const uploadStream = cloudinary.uploader.upload_stream(

      { folder },

      (error, result) => {

        if (error) return reject(error);

        resolve(result?.secure_url);

      }

    );

    uploadStream.end(fileBuffer);

  });

}


/* =====================================================
   QR GENERATOR
===================================================== */

export async function generateQR(data: string): Promise<string> {

  try {

    return await QRCode.toDataURL(data);

  } catch (err) {

    console.error("QR Generation failed", err);

    throw err;

  }

}


/* =====================================================
   PDF GENERATOR
===================================================== */

export function generateEventPassPDF(
  userName: string,
  eventName: string
): Promise<Buffer> {

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument();

    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => resolve(Buffer.concat(buffers)));

    doc.on("error", reject);


    doc.fontSize(25).text("Event Pass", {
      align: "center"
    });

    doc.moveDown();

    doc.fontSize(16).text(`Name: ${userName}`);

    doc.text(`Event: ${eventName}`);

    doc.moveDown();

    doc.text("Scan QR Code at entry.");

    doc.end();

  });

}