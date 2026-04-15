window.AppMarkdown = {
    renderer: null,

    init() {
        if (typeof marked === 'undefined') return;
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        this.renderer = new marked.Renderer();
        this.renderer.code = this.safeCodeBlock.bind(this);
        marked.use({ renderer: this.renderer });
    },

    safeCodeBlock(code, language) {
        const lang = language || '';
        const validLang = /^[a-zA-Z0-9_-]+$/.test(lang) ? lang : '';
        return `<pre><code class="${validLang ? `language-${validLang}` : ''}">${this.escapeHtml(code)}</code></pre>`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    parse(markdown) {
        if (typeof marked === 'undefined') return this.escapeHtml(markdown);
        try {
            return marked.parse(markdown);
        } catch (e) {
            console.error('Markdown parse error:', e);
            return this.escapeHtml(markdown);
        }
    },

    sanitize(html, extraOptions = {}) {
        if (typeof DOMPurify === 'undefined') return html;
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li',
                'blockquote', 'pre', 'code',
                'a', 'img',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'hr', 'span', 'div',
                'think'
            ],
            ALLOWED_ATTR: [
                'href', 'src', 'alt', 'title', 'class', 'id',
                'target', 'rel', 'width', 'height'
            ],
            ALLOW_DATA_ATTR: false,
            ...extraOptions
        });
    },

    render(text) {
        if (!text) return '';
        const html = this.parse(text);
        return this.sanitize(html);
    },

    render/g) || []).length;
        if (openCount > closeCount) {
            processed += '</think>';
        }
        return this.render(processed);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.AppMarkdown.init();
});
