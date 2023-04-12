import Dexie from "dexie";

export const db = new Dexie("zik");

db.version(1).stores({
    chats: "++id, title, uuid",
    conversations: "++id, uuid",
    plugins: "++id, name_for_human"
});