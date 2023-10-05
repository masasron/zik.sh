import { db } from "db";
import { SSE } from "sse.js";
import Head from "next/head";
import { useRouter } from "next/router";
import Tooltip from "components/Tooltip";
import { useState, useEffect } from "react";
import Conversation from "utils/Conversation";
import { useLiveQuery } from "dexie-react-hooks";
import ChatHistory from "components/ChatHistory";
import { GenerateTitle } from "utils/GenerateTitle";
import SettingsDialog from "components/SettingsDialog";
import TypeWriterSetState from "utils/TypeWriterSetState";
import AssistantMessage from "components/AssistantMessage";
import AutoResizedTextarea from "components/AutoResizedTextarea";
import PluginManagmentDialog from "components/PluginManagmentDialog";

const SUPPORTED_MODELS = [
    { name: "GPT4All", value: "gpt4all" },
    { name: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
    { name: "GPT-4", value: "gpt-4" },
];

const MODEL_VALUE_TO_NAME = {
    "gpt4all": "GPT4All",
    "gpt-3.5-turbo": "GPT-3.5 Turbo",
    "gpt-4": "GPT-4",
};

export default function Chat() {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [source, setSource] = useState(null);
    const [settings, setSettings] = useState({});
    const [messages, setMessages] = useState([]);
    const [plugin, setPlugin] = useState("none");
    const [editable, setEditable] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [model, setModel] = useState("gpt-3.5-turbo");
    const [conversation, _] = useState(new Conversation());
    const [showSettings, setShowSettings] = useState(false);
    const [activePlugin, setActivePlugin] = useState(null);
    const [messageError, setMessageError] = useState(false);
    const [streamedMessage, setStreamedMessage] = useState("");
    const [showScrollDown, setShowScrollDown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPluginsManagment, setShowPluginsManagment] = useState(false);

    const plugins = useLiveQuery(() => db.plugins.toArray());

    useEffect(function () {
        handleSettingsDialogClose();

        // get the last conversation model and set it as the default
        db.chats.orderBy("id").last().then(chat => {
            if (!chat) {
                return;
            }
            setModel(chat.model);
        }).catch(error => {
            console.error(error);
        });

        // detect when scroll is needed
        let messagesContainer = document.querySelector("main");
        if (!messagesContainer) {
            return;
        }

        messagesContainer.addEventListener("scroll", showScrollToBottomButton);

        return function () {
            messagesContainer.removeEventListener("scroll", showScrollToBottomButton);
        }
    }, []);

    useEffect(function () {
        if (!router.query.id) {
            return;
        }

        setTitle("");
        setMessageError(false);
        setMessages([]);
        setEditable(null);
        setPlugin("none");
        setActivePlugin(null);
        setStreamedMessage("");
        setShowMenu(false);

        db.conversations.where("uuid").equals(router.query.id).first().then(conv => {
            if (!conv) {
                return;
            }

            conversation.load(conv.json);
            setMessages(conversation.flatten());
            handleSettingsDialogClose();

            requestAnimationFrame(() => {
                scrollDown(false);
            });
        });

        db.chats.where("uuid").equals(router.query.id).first().then(chat => {
            if (!chat) {
                return;
            }

            setTitle(chat.title);
            setModel(chat.model);
            setActivePlugin(chat.plugin);
        });
    }, [router.query]);

    useEffect(function () {
        async function handleIncomingMessage(event) {
            console.log(event.data);
            if (event.data.trim() === "[DONE]") {
                setStreamedMessage(content => {
                    if (!content) {
                        return "";
                    }
                    conversation.regenerateReplyTo(conversation.currentNode, content);
                    setMessages(conversation.flatten());
                    presistConversation();
                    requestAnimationFrame(() => {
                        scrollDown(false);
                    });
                    setLoading(false);
                    return "";
                });
                return source?.close();
            }

            const payload = JSON.parse(event.data);
            const text = payload?.choices[0]?.delta?.content;

            if (text) {
                setStreamedMessage(oldMsg => {
                    if (oldMsg === "" && text.trim() === "") {
                        return "";
                    }

                    let newStreamedMessage = oldMsg + text;
                    if (newStreamedMessage.length % 18 === 0) {
                        scrollDown(false);
                    }
                    return newStreamedMessage;
                });
            }
        }

        source?.addEventListener("readystatechange", event => {
            if (event.readyState >= 2) {
                setLoading(false);
            }
        });

        source?.addEventListener("message", handleIncomingMessage);

        source?.addEventListener("error", err => {
            console.log(err);
            setLoading(false);
            setMessageError(true);
            setStreamedMessage("Failed to connect to the model server.\nPlease make sure the server is running and the URL is correct.");
        });

        if (source?.readyState === -1) {
            source.stream();
        }

        return function () {
            source?.close();
        }
    }, [source]);

    function showScrollToBottomButton(event) {
        var target = event.target;
        if (target.scrollHeight - target.scrollTop === target.clientHeight) {
            setShowScrollDown(false);
        } else {
            setShowScrollDown(true);
        }
    }

    async function presistConversation() {
        let conv = await db.conversations.where("uuid").equals(router.query.id).first();

        if (!conv) {
            return await db.conversations.add({
                uuid: router.query.id,
                json: conversation.toJSON(),
            });
        }

        return await db.conversations.update(conv.id, {
            json: conversation.toJSON(),
        });
    }

    async function handleChangePath(node, index) {
        conversation.changeConversationPath(node.ref.parent, index);
        setMessages(conversation.flatten());
        await presistConversation();
    }

    async function sendMessage(prompt, isPlugin = false) {
        if ((model === "gpt-4" || model === "gpt-3.5-turbo") && !settings?.openai_api_key) {
            return setShowSettings(true);
        }

        prompt = prompt.trim();

        if (!prompt) {
            return;
        }

        setMessageError(false);
        setStreamedMessage("");

        setTimeout(() => {
            window.dispatchEvent(new Event("textarea-resize"));
            scrollDown(true);
        }, 100);

        if (activePlugin) {
            switch (activePlugin.api.type) {
                case "openapi":
                    let systemPrompt = `Enabled plugin:${activePlugin.name_for_human}\nDescription:${activePlugin.description_for_model}\nOpenAPI:\n${activePlugin.openapi_yaml}\n\n`;
                    systemPrompt += "When the user message fits the plugin's description, start the response with 'Using {plugin_name}...' where {plugin_name} is the plugin's name.";
                    systemPrompt += "Followed by: '```plugin\n{\"url\": \"{server}\", \"options\": {options}}\n```'\n";
                    systemPrompt += "Where {server} is the server's URL and {options} is the options object for the fetch function.\n";
                    systemPrompt += "If required parameters are missing, ask the user for each of them before making the request.\n";
                    systemPrompt += "After responding with the plugin syntax, the next message would will include the request outcome, so don't ask the user anything before that.\n";
                    conversation.setSystemMessage(systemPrompt);
                    break;
                case "system_prompt":
                    conversation.setSystemMessage(activePlugin.api.prompt);
                    break;
            }
        }

        if (messages.length === 0) {
            GenerateTitle(prompt, settings?.openai_api_key).then(async newTitle => {
                setTitle("");
                TypeWriterSetState(newTitle, setTitle);

                const chat = await db.chats.where("uuid").equals(router.query.id).first();

                if (!chat) {
                    db.chats.add({
                        uuid: router.query.id,
                        title: newTitle,
                        model: model,
                        plugin: activePlugin
                    });
                } else {
                    db.chats.update(chat.id, {
                        title: newTitle,
                    });
                }
            });
        }

        if (!isPlugin) {
            conversation.userSend(prompt);
        } else {
            conversation.assistantSend(prompt);
        }

        let flattenMessages = conversation.flatten();
        setMessages(flattenMessages);
        startSSE(flattenMessages);
    }

    function startSSE(messages) {
        setLoading(true);
        setStreamedMessage("");

        let url, auth;
        switch (model) {
            case "gpt-4":
            case "gpt-3.5-turbo":
                auth = `Bearer ${settings?.openai_api_key}`;
                url = "https://api.openai.com/v1/chat/completions";
                break;
            default:
                auth = "";
                url = settings?.gpt4all_server_url;
                break;
        }

        let data = {
            model,
            messages: messages.map(m => {
                return { role: m.role, content: m.content };
            }),
            max_tokens: 2000,
            stream: true
        };

        setSource(oldSource => {
            oldSource?.close();
            return new SSE(url, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": auth,
                },
                method: "POST",
                payload: JSON.stringify(data)
            });
        });
    }

    function scrollDown(smooth = true) {
        let messagesContainer = document.querySelector("main")

        if (!messagesContainer) {
            return;
        }

        if (smooth) {
            return messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight + 1000,
                behavior: "smooth"
            })
        }

        messagesContainer.scrollTo(0, messagesContainer.scrollHeight + 1000);
    }

    function handleCancel(el) {
        let message = messages[editable];
        el.innerText = message.content;
        setEditable(null);
    }

    async function handleSaveAndSubmit(newContent, node) {
        conversation.edit(node.ref, newContent);
        let flattenMessages = conversation.flatten();
        setMessages(flattenMessages);
        setEditable(null);
        await sendToServer(flattenMessages);
    }

    async function handleRegenerate() {
        let flattenMessages = conversation.flatten();
        flattenMessages.pop();
        setMessages(flattenMessages);
        conversation.currentNode = flattenMessages[flattenMessages.length - 1].ref;
        await sendToServer(flattenMessages);
    }

    async function sendToServer(flattenMessages) {
        setMessageError(false);
        setStreamedMessage("");
        startSSE(flattenMessages);
    }

    function handleSettingsDialogClose() {
        setShowSettings(false);
        setSettings(JSON.parse(localStorage.getItem("settings")));
    }

    async function handleDeleteAll() {
        if (!confirm("Are you sure you want to delete all messages?")) {
            return;
        }

        await db.chats.clear();
        await db.conversations.clear();

        router.push("/");
    }

    function handleMessageRequest(messageContent) {
        sendMessage(messageContent, true);
    }

    async function handlePluginChange(event) {
        setPlugin(event.target.value);

        switch (event.target.value) {
            case "manage-plugins":
                setPlugin("none");
                setShowPluginsManagment(true);
                break;
            default:
                let pluginData = await db.plugins.where("name_for_human").equals(event.target.value).first();

                if (!pluginData) {
                    console.error("Plugin not found in database");
                    return;
                }

                setActivePlugin(pluginData);
                break;
        }
    }

    function handleForceStop() {
        setStreamedMessage(content => {
            if (!content) {
                return "";
            }
            conversation.regenerateReplyTo(conversation.currentNode, content);
            setMessages(conversation.flatten());
            presistConversation();
            requestAnimationFrame(() => {
                scrollDown(false);
            });
            return "";
        });
        source?.close();
        setLoading(false);
    }

    function handleModelChange(event) {
        let newModel = event.target.value;
        let selectedPlugin = plugins.find(p => p.name === plugin);

        if (!selectedPlugin?.supported_models?.includes(newModel)) {
            setPlugin("none");
            setActivePlugin(null);
        }

        setModel(newModel);
    }

    function handleCopy(text, node) {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            copyText(text);
        }

        let span;

        switch (node.tagName) {
            case "SPAN":
                span = node;
                break;
            case "BUTTON":
                span = node.querySelector("span");
                break;
        }

        if (span) {
            span.innerText = "check";
            setTimeout(function () {
                span.innerText = "content_copy";
            }, 1000);
        }
    }

    function copyText(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : false;
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (selected) {
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(selected);
        }
    }

    return <>
        <Head>
            <title>{title || "New Chat"}</title>
        </Head>
        <div className="application-chat">
            <aside className={showMenu ? "show" : ""}>
                <button onClick={() => router.push("/")} className="add-button"><span className="material-symbols-outlined">add</span> New chat</button>
                <hr />
                <ChatHistory onChange={item => setTitle(item.title)} chatId={router?.query?.id} />
                <footer>
                    <div className="flex">
                        <Tooltip position="top" text="Settings">
                            <div className="item" onClick={() => setShowSettings(true)}>
                                <div className="material-symbols-outlined">settings</div>
                            </div>
                        </Tooltip>
                        <Tooltip position="top" text="Plugins">
                            <div className="item" onClick={() => setShowPluginsManagment(true)}>
                                <span className="material-symbols-outlined">
                                    extension
                                </span>
                            </div>
                        </Tooltip>
                        <Tooltip position="top" text="Clear conversations">
                            <div className="item" onClick={handleDeleteAll}>
                                <div className="material-symbols-outlined">delete</div>
                            </div>
                        </Tooltip>
                    </div>
                </footer>
            </aside>
            <main>
                <div className="messages">
                    <div className="messages-header">
                        <button onClick={() => setShowMenu(true)} className="menu">
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div style={{ flex: 1 }}>
                            <strong>{title || "New chat"}</strong>
                            {model && <label>
                                {MODEL_VALUE_TO_NAME[model] || model}
                                {activePlugin && <>
                                    <Tooltip text={activePlugin.name_for_human}>
                                        <div className="active-plugin"><img src={activePlugin.logo_url} /></div>
                                    </Tooltip>
                                </>}
                            </label>}
                        </div>
                        <button onClick={() => router.push("/")} className="add">
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>
                    {!messages || messages.length === 0 && <>
                        <div className="model-selector-container">
                            <div className="model-selector">
                                <label>Model</label>
                                <select value={model} onChange={handleModelChange}>
                                    {SUPPORTED_MODELS.filter(({ value }) => {
                                        if (value === "gpt4all" && !settings?.gpt4all_server_url) {
                                            return false;
                                        }
                                        return true;
                                    }).map((model, index) => <option key={index} value={model.value}>{model.name}</option>)}
                                </select>
                            </div>
                            <div className="model-selector">
                                <label>Plugin</label>
                                <select value={plugin} onChange={handlePluginChange}>
                                    <option value="none" disabled>No plugin enabled</option>
                                    {plugins && plugins.map((plugin, index) => <option key={index} disabled={plugin?.supported_models && !plugin?.supported_models?.includes(model)} value={plugin.name_for_human}>{plugin.name_for_human}</option>)}
                                    <option value="manage-plugins">Manage plugins</option>
                                </select>
                            </div>
                        </div>
                        <div className="welcome-message">
                            <h1>Welcome to Cogit.<strong>ai</strong>!</h1>
                            <p>Cogit.<strong>ai</strong> is your portal to the future of smart identies.</p>
                        </div>
                    </>}
                    {messages && messages.map((msg, index) => <>
                        {(settings?.show_system_messages || msg.role !== "system") && <div key={index} className={`message ${msg.role}`}>
                            <div className="container actionbar">
                                {msg.role === "user" && editable === null && <button className="edit" onClick={() => (setEditable(index), setTimeout(() => document.querySelector(".user_message_" + index)?.focus(), 50))}>
                                    <span className="material-symbols-outlined">edit</span>
                                </button>}
                                {msg.role === "assistant" && index === messages.length - 1 && <button onClick={() => handleRegenerate()} className="regenerate">
                                    <span className="material-symbols-outlined">refresh</span>
                                </button>}
                                {msg.role === "assistant" && <button onClick={(e) => handleCopy(msg.content, e.target)}>
                                    <span className="material-symbols-outlined">content_copy</span>
                                </button>}
                            </div>
                            <div className="container">
                                <div className={"avatar " + model.replace(/\./g, "-")}>
                                    {msg.role === "user" && <>{settings?.initials || "U"}</>}
                                    {msg.role === "system" && <>S</>}
                                </div>
                                <div className="content">
                                    {msg.role !== "assistant" && <p className={"user_message_" + index} contentEditable={editable === index}>{msg.content}</p>}
                                    {msg.role === "assistant" && <AssistantMessage autoExecute={index === messages.length - 1} onMessageRequest={handleMessageRequest} content={msg.content} />}
                                    {editable === index && <>
                                        <div className="edit-actions">
                                            <button onClick={event => handleSaveAndSubmit(event.target.parentElement.parentElement.firstChild.innerText, msg)}>Save & Submit</button>
                                            <button className="cancel" onClick={() => handleCancel(event.target.parentElement.parentElement.firstChild)}>Cancel</button>
                                        </div>
                                    </>}
                                </div>
                            </div>
                            <div className="container">
                                {msg.childrenLength > 1 && <div className="paths">
                                    <button disabled={msg.childrenIndex - 1 < 0} onClick={() => handleChangePath(msg, msg.childrenIndex - 1)}>&lt;</button>
                                    <label>{`${msg.childrenIndex + 1}/${msg.childrenLength}`}</label>
                                    <button disabled={msg.childrenIndex + 1 >= msg.childrenLength} onClick={() => handleChangePath(msg, msg.childrenIndex + 1)}>&gt;</button>
                                </div>}
                            </div>
                        </div>}
                    </>)}
                    {streamedMessage && <div className={`message assistant ${messageError ? "error" : "stream"}`}>
                        <div className="container">
                            <div className={"avatar " + model.replace(/\./g, "-")}></div>
                            <div className="content">
                                <AssistantMessage content={streamedMessage} />
                            </div>
                        </div>
                    </div>}
                </div>
                <div className="text-center">
                    <div className="control">
                        <AutoResizedTextarea onStop={handleForceStop} loading={loading} onMessage={sendMessage} placeholder="Type your message" autoComplete="off" />
                    </div>
                </div>
            </main>
        </div>
        {showScrollDown && <div className="scroll-to-bottom" onClick={() => scrollDown(true)}>
            <span className="material-symbols-outlined">expand_more</span>
        </div>}
        {showSettings && <SettingsDialog onClose={handleSettingsDialogClose} />}
        {showPluginsManagment && <PluginManagmentDialog settings={settings} onClose={() => setShowPluginsManagment(false)} />}
        {showMenu && <div onClick={() => showMenu && setShowMenu(false)} className="mask" />}
    </>
}
