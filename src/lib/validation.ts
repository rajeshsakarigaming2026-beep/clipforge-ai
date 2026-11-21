import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  sourceType: z.enum(["upload", "url"]),
  sourceUrl: z.string().optional(),
  fileName: z.string().optional(),
  storagePath: z.string().optional(),
  topic: z.string().min(1).max(80),
});

export const clipEditSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(1).optional(),
  captionColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  highlightColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  camX: z.number().min(0).max(1).optional(),
  camY: z.number().min(0).max(1).optional(),
  camW: z.number().min(0.05).max(1).optional(),
  camH: z.number().min(0.05).max(1).optional(),
  zoom: z.number().min(1).max(2).optional(),
  playbackSpeed: z.number().min(0.5).max(2).optional(),
  layout: z.enum(["auto", "stack", "crop", "blur"]).optional(),
});
