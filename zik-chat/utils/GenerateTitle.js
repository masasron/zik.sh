export async function GenerateTitle(content, apiKey) {
    content = content.trim();

    if (!content) {
        return "Untitled";
    }

    try {
        if (!apiKey) {
            throw new Error("No API key provided");
        }

        const response = await fetch("https://api.openai.com/v1/completions", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            method: "POST",
            body: JSON.stringify({
                "model": "text-ada-001",
                "prompt": content + "\n\nGive a short title to the text above:\"",
                "temperature": 0.7,
                "max_tokens": 10,
                "top_p": 1,
                "frequency_penalty": 0,
                "presence_penalty": 0,
                "stop": ["\""]
            })
        });

        if (response.status !== 200) {
            throw new Error("Failed to generate title");
        }

        const jsonResponse = await response.json();
        console.log(jsonResponse);
        const text = jsonResponse.choices[0].text;

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