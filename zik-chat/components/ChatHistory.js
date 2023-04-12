import { db } from "db";
import { useState } from "react";
import { useRouter } from "next/router";
import { useLiveQuery } from "dexie-react-hooks";

export default function ChatHistory(props) {
    const chatId = props.chatId;

    const router = useRouter();
    const [editItem, setEditItem] = useState(null);
    const [itemToBeDeleted, setItemToBeDeleted] = useState(null);

    const chatHistory = useLiveQuery(() => {
        return db.chats.reverse().toArray();
    }, []);

    function handleOperationCancellation() {
        setEditItem(null);
        setItemToBeDeleted(null);
    }

    function handleClick(item) {
        router.push(`/chat/${item.uuid}`);
    }

    async function handleChatDelete(event) {
        event.preventDefault();
        event.stopPropagation();
        await db.chats.where("uuid").equals(chatId).delete();
        await db.conversations.where("uuid").equals(chatId).delete();
        const firstChat = chatHistory.find((item) => item.uuid !== chatId);
        if (firstChat) {
            router.push(`/chat/${firstChat.uuid}`);
        } else {
            router.push("/");
        }
        handleOperationCancellation();
    }

    async function handleItemUpdate(id, newTitle, event) {
        event.preventDefault();
        event.stopPropagation();

        await db.chats.update(id, { title: newTitle });
        setEditItem(null);
    }

    return <ul>
        {chatHistory && chatHistory.map((item, index) => <li className={chatId === item.uuid ? "active" : ""} onClick={() => handleClick(item)} key={index}>
            <label contentEditable={editItem === item.uuid}>{item.title}</label>
            <div style={{ flex: 1 }} />
            {item.uuid === chatId && editItem === null && itemToBeDeleted === null && <>
                <button onClick={() => setEditItem(item.uuid)} className="edit">
                    <span className="material-symbols-outlined">edit</span>
                </button>
                <button onClick={() => setItemToBeDeleted(item.uuid)} className="delete">
                    <span className="material-symbols-outlined">delete</span>
                </button>
            </>}
            {item.uuid === chatId && editItem !== null && <button onClick={(event) => handleItemUpdate(item.id, event.target.parentElement.firstChild.innerText, event)} className="checkmark">
                <span className="material-symbols-outlined">check</span>
            </button>}
            {item.uuid === chatId && itemToBeDeleted !== null && <button onClick={handleChatDelete} className="checkmark">
                <span className="material-symbols-outlined">check</span>
            </button>}
            {item.uuid === chatId && (itemToBeDeleted || editItem) && <>
                <button onClick={handleOperationCancellation} className="cancel">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </>}
        </li>)}
    </ul>
}