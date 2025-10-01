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
    }),
    folders: i.entity({
      text: i.string(), // folder name
      color: i.string(), // folder color (#hex)
      isDefault: i.boolean(), // whether this is the default inbox folder
      userId: i.string().indexed().optional(), // owner user ID
    }),
    todos: i.entity({
      text: i.string(), // task description
      done: i.boolean(), // completion status
      createdAt: i.number().indexed(), // creation timestamp for ordering
      userId: i.string().indexed().optional(), // owner user ID
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
