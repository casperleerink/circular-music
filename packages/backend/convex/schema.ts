import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  players: defineTable({
    userId: v.id("users"),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
  }),
});
