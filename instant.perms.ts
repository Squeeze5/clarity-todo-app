// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/core";

const rules = {
  // Users can only access their own folders
  folders: {
    allow: {
      view: "data.userId == auth.id || data.userId == null",
      create: "isAuthenticated", 
      update: "data.userId == auth.id || data.userId == null",
      delete: "data.userId == auth.id || data.userId == null",
    },
    bind: ["isAuthenticated", "data.userId == auth.id || data.userId == null"],
  },
  // Users can only access their own todos
  todos: {
    allow: {
      view: "data.userId == auth.id || data.userId == null",
      create: "isAuthenticated",
      update: "data.userId == auth.id || data.userId == null", 
      delete: "data.userId == auth.id || data.userId == null",
    },
    bind: ["isAuthenticated", "data.userId == auth.id || data.userId == null"],
  },
} satisfies InstantRules;

export default rules;
