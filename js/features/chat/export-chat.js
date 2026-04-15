window.AppExportChat = {
    export() {
        const history = window.AppState.getHistory();
        if (history.length === 0) {
            window.AppToasts.show('No chat history to export.', 'error');
            return;
        }

        const mdContent = history.map(m => {
            const text = window.AppMessageContent.extractText(m.content);
            return `### ${m.role.toUpperCase()}\n${text}`;
        }).join('\n\n---\n\n');

        const blob = new Blob([mdContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rubybox_chat_${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        window.AppToasts.show('Chat exported to Markdown.');
    }
};
