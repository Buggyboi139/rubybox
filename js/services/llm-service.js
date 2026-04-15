window.AppLLMService = {
    async complete({ model, temperature, max_tokens, messages, signal }) {
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();
        if (!apiKey) {
            return { data: null, error: new Error('OpenRouter API key not available') };
        }

        const url = window.AppConfig.OPENROUTER_API_URL;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    temperature,
                    max_tokens,
                    messages,
                    stream: false
                }),
                signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async streamComplete({ model, temperature, max_tokens, messages, signal, onChunk, onComplete }) {
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();
        if (!apiKey) {
            return { data: null, error: new Error('OpenRouter API key not available') };
        }

        const url = window.AppConfig.OPENROUTER_API_URL;
        let reader = null;
        let aborted = false;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    temperature,
                    max_tokens,
                    messages,
                    stream: true
                }),
                signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const cleanLine = line.replace(/^data: /, '').trim();
                    if (!cleanLine || cleanLine === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(cleanLine);
                        const delta = parsed.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            fullText += delta;
                            if (onChunk) onChunk(delta, fullText);
                        }
                    } catch (e) {
                        // skip malformed lines
                    }
                }
            }

            if (onComplete) onComplete(fullText);
            return { data: { text: fullText }, error: null };
        } catch (e) {
            if (e.name === 'AbortError') {
                aborted = true;
            }
            return { data: aborted ? null : null, error: e };
        }
    },

    async generateTitle(firstPrompt, conversationId) {
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();
        if (!apiKey) return { error: new Error('No API key') };

        try {
            const response = await fetch(window.AppConfig.OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [{
                        role: 'user',
                        content: `Summarize this into a 3-5 word title. Only output the title: ${firstPrompt}`
                    }],
                    stream: false
                })
            });

            if (!response.ok) throw new Error('Title generation failed');

            const data = await response.json();
            const title = data.choices[0].message.content
                .replace(/["']/g, '')
                .trim();

            await window.AppConversationsService.updateTitle(conversationId, title);
            return { data: title, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async synthesizeScenarioPrompt(historyMessages) {
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();
        if (!apiKey) return { error: new Error('No API key') };

        const sysPrompt = 'You are a visual prompt engineer. Read the chat history and summarize the current physical scenario, character appearance, and environment into a single, comma-separated list of highly descriptive visual tags for a Stable Diffusion image generator. Output ONLY the raw tags. Do not include introductory text, explanations, or dialogue.';

        const chatLog = historyMessages
            .map(m => `${m.role}: ${window.AppMessageContent.extractText(m.content)}`)
            .join('\n');

        try {
            const response = await fetch(window.AppConfig.OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-v3.2',
                    messages: [
                        { role: 'system', content: sysPrompt },
                        { role: 'user', content: chatLog }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) throw new Error('Scenario synthesis failed');

            const data = await response.json();
            const prompt = data.choices[0].message.content.trim();
            return { data: prompt, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    },

    async buildArchitectProfile(userPrompt) {
        const apiKey = window.AppConfigLoader.getDecryptedApiKey();
        if (!apiKey) return { error: new Error('No API key') };

        const sysPrompt = `Role: You are the NSFW Architect, an expert and perverted world-builder and system designer. Your objective is to take a user's seed prompt and construct a highly sexual interactive, lore-dense, and mechanically sound scenario. The output may represent a single complex character, an ensemble cast (e.g., a harem), or a complete open-world RPG framework. Directive: Maximize information density and interactive potential. Zero flowery exposition. Do not write passive history; write active conflicts. Ground the world in sensory details and strict internal logic. Every word should help to fundamentally shape the lewd character or scenario. Output Structure: Whenever the user provides a prompt, you must generate the framework using the following strict categories: 1. Core Premise & Framework 2. Environmental Design (World-Building) 3. Entity/Cast Diagnostics (Character-Building) 4. The Engine (Event Triggers) 5. Point of Entry (The Opening) CRITICAL SYSTEM REQUIREMENT: You MUST output your entire response as a single, valid JSON object. Do not wrap it in markdown code blocks like \`\`\`json. The JSON must exactly match this schema: { "name": "A brutal, concise title for this scenario or character", "avatar_prompt": "A comma-separated list of highly specific visual tags based on the Entity/Environmental design to be fed into a Stable Diffusion image generator (e.g., 1girl, glowing neon, hyper-detailed, specific clothing/anatomy).", "system_prompt": "The complete, detailed text of all 5 categories requested above, cleanly formatted in markdown." }`;

        try {
            const response = await fetch(window.AppConfig.OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek/deepseek-v3.2',
                    messages: [
                        { role: 'system', content: sysPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.85
                })
            });

            if (!response.ok) throw new Error('Architect synthesis failed');

            const data = await response.json();
            const rawText = data.choices[0].message.content
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            const profile = JSON.parse(rawText);
            return {
                data: {
                    name: profile.name.replace(/<[^>]*>?/gm, '').replace(/(\{\{|<\||\|>|\}\})/g, '').trim(),
                    avatar_prompt: profile.avatar_prompt,
                    system_prompt: profile.system_prompt.replace(/<[^>]*>?/gm, '').replace(/(\{\{|<\||\|>|\}\})/g, '').trim()
                },
                error: null
            };
        } catch (e) {
            return { data: null, error: e };
        }
    }
};
