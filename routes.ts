import { z } from 'zod';
import { 
  loginSchema, registerSchema, insertAnnouncementSchema, insertEventSchema, insertFeedPostSchema,
  insertClubSchema, insertCompanySchema, insertMaterialSchema, insertPlacementSchema, insertBannerSchema,
  users, announcements, events, feedPosts, clubs, companies, materials, placements, banners, results,
  insertResultSchema
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  unauthorized: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: registerSchema,
      responses: {
        201: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        400: errorSchemas.validation,
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: loginSchema,
      responses: {
        200: z.object({ token: z.string(), user: z.custom<typeof users.$inferSelect>() }),
        401: errorSchemas.unauthorized,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  },
  announcements: {
    list: {
      method: 'GET' as const,
      path: '/api/announcements' as const,
      responses: { 200: z.array(z.custom<typeof announcements.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/announcements' as const,
      input: insertAnnouncementSchema,
      responses: { 201: z.custom<typeof announcements.$inferSelect>() }
    }
  },
  events: {
    list: {
      method: 'GET' as const,
      path: '/api/events' as const,
      responses: { 200: z.array(z.custom<typeof events.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/events' as const,
      input: insertEventSchema,
      responses: { 201: z.custom<typeof events.$inferSelect>() }
    }
  },
  feed: {
    list: {
      method: 'GET' as const,
      path: '/api/feed' as const,
      responses: { 200: z.array(z.custom<typeof feedPosts.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/feed' as const,
      input: insertFeedPostSchema,
      responses: { 201: z.custom<typeof feedPosts.$inferSelect>() }
    }
  },
  clubs: {
    list: {
      method: 'GET' as const,
      path: '/api/clubs' as const,
      responses: { 200: z.array(z.custom<typeof clubs.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/clubs' as const,
      input: insertClubSchema,
      responses: { 201: z.custom<typeof clubs.$inferSelect>() }
    }
  },
  companies: {
    list: {
      method: 'GET' as const,
      path: '/api/companies' as const,
      responses: { 200: z.array(z.custom<typeof companies.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/companies' as const,
      input: insertCompanySchema,
      responses: { 201: z.custom<typeof companies.$inferSelect>() }
    }
  },
  materials: {
    list: {
      method: 'GET' as const,
      path: '/api/materials' as const,
      responses: { 200: z.array(z.custom<typeof materials.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/materials' as const,
      input: insertMaterialSchema,
      responses: { 201: z.custom<typeof materials.$inferSelect>() }
    }
  },
  placements: {
    list: {
      method: 'GET' as const,
      path: '/api/placements' as const,
      responses: { 200: z.array(z.custom<typeof placements.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/placements' as const,
      input: insertPlacementSchema,
      responses: { 201: z.custom<typeof placements.$inferSelect>() }
    }
  },
  banners: {
    list: {
      method: 'GET' as const,
      path: '/api/banners' as const,
      responses: { 200: z.array(z.custom<typeof banners.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/banners' as const,
      input: insertBannerSchema,
      responses: { 201: z.custom<typeof banners.$inferSelect>() }
    }
  },
  results: {
    list: {
      method: 'GET' as const,
      path: '/api/results' as const,
      responses: { 200: z.array(z.custom<typeof results.$inferSelect>()) }
    },
    create: {
      method: 'POST' as const,
      path: '/api/results' as const,
      input: insertResultSchema,
      responses: { 201: z.custom<typeof results.$inferSelect>() }
    }
  },

  // ✅ PROFILE ADDED (NO EXISTING CODE MODIFIED)

  profile: {
    get: {
      method: 'GET' as const,
      path: '/api/profile' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/profile' as const,
      input: z.object({
        name: z.string().optional(),
        departmentId: z.number().optional(),
        jntuNumber: z.string().optional(),
        year: z.number().optional(),
        profileImage: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      }
    }
  }

};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type AuthResponse = z.infer<typeof api.auth.login.responses[200]>;