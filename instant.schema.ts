// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/core";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      passwordHash: i.string().optional(), // hashed password for authentication
    }),
    folders: i.entity({
      text: i.string(), // folder name
      color: i.string(), // folder color (#hex)
      isDefault: i.boolean(), // whether this is the default inbox folder
      parentFolderId: i.string().indexed().optional(), // parent folder ID for subfolders
      level: i.number().optional(), // nesting level (0 for root, 1 for first level subfolder, etc.)
      path: i.string().optional(), // full path like "parent/child/grandchild"
      userId: i.string().indexed().optional(), // owner user ID
    }),
    todos: i.entity({
      text: i.string(), // task name
      description: i.string().optional(), // task description/details
      done: i.boolean(), // completion status
      createdAt: i.number().indexed(), // creation timestamp for ordering
      dueDate: i.number().indexed().optional(), // due date timestamp (optional)
      dueTime: i.string().optional(), // time in HH:MM format (optional)
      priority: i.number().optional(), // priority level 1-4 (P1=1, P2=2, P3=3, P4=4)
      labels: i.string().optional(), // comma-separated labels/tags
      reminderType: i.string().optional(), // 'email', 'notification', or 'none'
      reminderTiming: i.string().optional(), // '10min', '30min', '1hour', '2hours', '1day', etc.
      reminderSent: i.boolean().optional(), // track if reminder was sent
      reminderTimestamp: i.number().indexed().optional(), // calculated timestamp for when to send reminder
      userId: i.string().indexed().optional(), // owner user ID
      userEmail: i.string().optional(), // user email for backend email sending
    }),
    subtasks: i.entity({
      text: i.string(), // subtask description
      done: i.boolean(), // completion status
      createdAt: i.number().indexed(), // creation timestamp for ordering
      userId: i.string().indexed().optional(), // owner user ID
    }),
    sections: i.entity({
      text: i.string(), // section name
      order: i.number().indexed(), // display order within folder
      createdAt: i.number().indexed(), // creation timestamp
      userId: i.string().indexed().optional(), // owner user ID
    }),
    userPasswords: i.entity({
      userId: i.string().unique().indexed(), // user ID
      email: i.string().indexed(), // email for lookup
      passwordHash: i.string(), // bcrypt hashed password
      nickname: i.string().optional(), // user's custom display name
      createdAt: i.number().indexed(), // when password was set
      updatedAt: i.number().indexed(), // when password was last changed
    }),
  },
  links: {
    folderTodos: {
      forward: {
        on: "folders",
        has: "many",
        label: "todos"
      },
      reverse: {
        on: "todos",
        has: "one",
        label: "folder"
      }
    },
    todoSubtasks: {
      forward: {
        on: "todos",
        has: "many",
        label: "subtasks"
      },
      reverse: {
        on: "subtasks",
        has: "one",
        label: "todo"
      }
    },
    folderSections: {
      forward: {
        on: "folders",
        has: "many",
        label: "sections"
      },
      reverse: {
        on: "sections",
        has: "one",
        label: "folder"
      }
    },
    sectionTodos: {
      forward: {
        on: "sections",
        has: "many",
        label: "todos"
      },
      reverse: {
        on: "todos",
        has: "one",
        label: "section"
      }
    }
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
