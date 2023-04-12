import GPT4All from "./gpt4all.js";
import { WebSocketServer } from "ws";
import { Configuration, OpenAIApi } from "openai";

const MODELS = ["gpt-3.5-turbo", "gpt-4", "gpt4all"];

const PORT = process.env.SERVER_PORT || 3001;
const HOST = process.env.SERVER_HOST || "0.0.0.0";

const server = new WebSocketServer({ port: PORT, host: HOST }, (err) => {
    if (err) {
        return console.log(`[-] Failed to start WebSocket server: ${err}`);
    }
    console.log(`[+] WebSocket server started on port ${HOST}:${PORT}`);
});

server.on("connection", function (ws, request) {
    const qs = new URLSearchParams(request.url.split("?")[1]);

    const model = qs.get("model");
    const apiKey = qs.get("openai_api_key") || "";

    if (!model) {
        console.log("[-] Missing model parameter");
        ws.send("Missing model parameter");
        ws.send("[ERROR]");
        ws.close();
        return;
    }

    if (!MODELS.includes(model)) {
        console.log(`[-] Invalid model: ${model}`);
        ws.send("Unsupported model: " + model);
        ws.send("[ERROR]");
        ws.close();
        return;
    }

    let session;
    try {
        if (model === "gpt4all") {
            session = new GPT4All();
        }
    } catch (error) {
        console.log("[-] Failed to start GPT4All session");
        console.log(error);
        ws.send("Failed to start GPT4All session due to the following error:\n```text\n" + error.toString() + "\n```");
        ws.send("[ERROR]");
        ws.close();
        return;
    }

    const openai = new OpenAIApi(new Configuration({ apiKey }));

    switch (model) {
        case "gpt4all":
            console.log("started a new gpt4all session");
            session.open();
            session.onData((data) => {
                if (ws.readyState !== 1) {
                    return;
                }

                // replace \f with [DONE] to indicate end of conversation
                data = data.replace(/\f/g, "[DONE]");
                // replace \r with \n to make it look nicer
                data = data.replace(/\r/g, "\n");

                ws.send(data);
            });
            break;
    }

    let messagesReceived = 0;

    ws.on('message', async function (data) {
        const messages = JSON.parse(data.toString("utf-8"));

        if (!Array.isArray(messages)) {
            console.log("[-] Invalid message format, expected array");
            return;
        }

        messagesReceived++;

        switch (model) {
            case "gpt4all":
                let prompt = "";

                if (messagesReceived === 1) {
                    for (const message of messages) {
                        prompt += message.content + "\r";
                    }
                } else {
                    let lastMeesage = messages[messages.length - 1];
                    if (lastMeesage.role === "user") {
                        prompt = lastMeesage.content;
                    }
                }

                console.log("prompt:", prompt);
                prompt && session.prompt(prompt);
                break;
            case "gpt-4":
            case "gpt-3.5-turbo":
                try {
                    const completion = await openai.createChatCompletion(
                        {
                            stream: true,
                            messages,
                            model
                        }, { responseType: "stream" });

                    completion.data.on('data', async data => {
                        if (ws.readyState !== 1) {
                            return;
                        }

                        const lines = data.toString("utf-8").split("\n").filter(line => line.trim() !== "");

                        for (const line of lines) {
                            const message = line.replace(/^data: /, "");
                            if (message === '[DONE]') {
                                return ws.send(message);
                            }

                            try {
                                let parsed = JSON.parse(message);
                                let content = parsed?.choices[0]?.delta?.content?.toString("utf-8") || null;

                                if (content) {
                                    ws.send(content);
                                }
                            } catch (err) {
                                console.log(`[-] Failed to parse message: ${message}`);
                                console.log(err);
                            }
                        }
                    });
                } catch (error) {
                    console.log("[-] Failed to generate response from OpenAI");
                    console.log(error.toString());
                    ws.send("Failed to generate response from OpenAI, make sure your API key is valid and you have enough credits. For reference, here's the error:\n```text\n" + error.toString() + "\n```");
                    ws.send("[ERROR]");
                    ws.close();
                }
                break;
        }
    });

    ws.on('close', () => {
        switch (model) {
            case "gpt4all":
                session.close();
                break;
        }
    });

    ws.on("error", err => {
        console.log(`[-] Connection error: ${err}`);
    });
});

server.on("error", err => {
    console.log(`[-] Server error: ${err}`);
});

server.on("close", () => {
    console.log("[-] Server closed");
});