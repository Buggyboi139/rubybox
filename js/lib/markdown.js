window.AppMarkdown = {
    init() {
        if (typeof marked === 'undefined') return;

        try {
            marked.setOptions({
                breaks: true,
                gfm: true
            });

            const self = this;
            marked.use({
                renderer: {
                    code(codeOrToken, language) {
                        let code, lang;
                        if (codeOrToken && typeof codeOrToken === 'object') {
                            code = codeOrToken.text || '';
                            lang = codeOrToken.lang || '';
                        } else {
                            code = String(codeOrToken || '');
                            lang = language || '';
                        }
                        const validLang = /^[a-zA-Z0-9_-]+$/.test(lang) ? lang : '';
                        return `<pre><code class="${validLang ? `language-${validLang}` : ''}">${self._escapeHtml(code)}</code></pre>`;
                    }
                }
            });
        } catch (e) {
            console.error('Markdown renderer init failed:', e);
        }
    },

    _escapeHtml(text) {
        if (typeof text !== 'string') text = String(text);
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    parse(markdown) {
        if (typeof marked === 'undefined') return this._escapeHtml(markdown);
        try {
            return marked.parse(markdown);
        } catch (e) {
            console.error('Markdown parse error:', e);
            return this._escapeHtml(markdown);
        }
    },

    sanitize(html, extraOptions = {}) {
        if (typeof DOMPurify === 'undefined') return this._escapeHtml(html);
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS:[
                'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'ul', 'ol', 'li',
                'blockquote', 'pre', 'code',
                'a', 'img',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'hr', 'span', 'div',
                'think'
            ],
            ALLOWED_ATTR:[
                'href', 'src', 'alt', 'title', 'class', 'id',
                'target', 'rel', 'width', 'height'
            ],
            ALLOW_DATA_ATTR: false,
            ...extraOptions
        });
    },

    render(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);
        const html = this.parse(text);
        return this.sanitize(html);
    },

    renderWithThink(text) {
        if (!text) return '';
        if (typeof text !== 'string') text = String(text);

        const thinkOpen = '<think>';
        const thinkClose = '</think>';

        let result = '';
        let lastIndex = 0;
        let depth = 0;
        let openIndex = 0;

        while (true) {
            const nextOpen = text.indexOf(thinkOpen, lastIndex);
            const nextClose = text.indexOf(thinkClose, lastIndex);

            if (nextOpen === -1 && nextClose === -1) {
                result += this.render(text.slice(lastIndex));
                break;
            }

            if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
                if (depth === 0) {
                    result += this.render(text.slice(lastIndex, nextOpen));
                    openIndex = nextOpen + thinkOpen.length;
                    depth = 1;
                    lastIndex = openIndex;
                } else {
                    depth++;
                    lastIndex = nextOpen + thinkOpen.length;
                }
                continue;
            }

            if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) {
                if (depth === 1) {
                    const thinkContent = text.slice(lastIndex, nextClose).trim();
                    const renderedThink = this.render(thinkContent);
                    result += `<div class="think-content">${renderedThink}</div>`;
                    lastIndex = nextClose + thinkClose.length;
                    depth = 0;
                } else if (depth > 1) {
                    depth--;
                    lastIndex = nextClose + thinkClose.length;
                } else {
                    result += this.render(text.slice(lastIndex, nextClose));
                    lastIndex = nextClose + thinkClose.length;
                }
                continue;
            }
        }

        if (depth > 0) {
            const remaining = text.slice(openIndex).trim();
            if (remaining) {
                result += `<div class="think-content">${this.render(remaining)}</div>`;
            }
        }

        return result;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.AppMarkdown.init();
});