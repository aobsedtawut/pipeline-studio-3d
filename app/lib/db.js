import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton so hot-reload doesn't spawn a new
// PrismaClient (and a new DB connection pool) on every edit.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
