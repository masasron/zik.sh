function firstNWords(content, n) {
    return content.split(" ").slice(0, n).join(" ");
}

export async function GenerateTitle(content, apiKey) {
    content = content.trim();

    if (!content) {
        return "Untitled";
    }

    try {
        if (!apiKey) {
            throw new Error("No API key provided");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            method: "POST",
            body: JSON.stringify({
                "model": "gpt-3.5-turbo",
                "messages": [{ role: "user", content: firstNWords(content, 50) }, { role: "user", content: "Please suggest a very short title for the above text" }],
                "max_tokens": 15
            })
        });

        if (response.status !== 200) {
            throw new Error("Failed to generate title");
        }

        const jsonResponse = await response.json();
        let text = jsonResponse.choices[0].message.content;

        // if text starts and ends with ", remove them
        if (text.startsWith('"')) {
            text = text.slice(1);
        }

        if (text.endsWith('"')) {
            text = text.slice(0, -1);
        }

        if (text.toString().trim().length === 0) {
            throw new Error("Failed to generate title");
        }

        return text;
    } catch (error) {
        console.error("Failed to generate title");
        console.error(error);
    }

    // Fallback to the first 5 words of the content
    return content.split(" ").slice(0, 5).join(" ");
}