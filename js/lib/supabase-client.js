window.AppSupabase = {
    client: null,

    init(url, anonKey) {
        window.supabaseClient = window.supabase.createClient(url, anonKey);
        this.client = window.supabaseClient;
        return this.client;
    },

    getClient() {
        return this.client;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.AppSupabase.init(
        window.AppConfig.SUPABASE_URL,
        window.AppConfig.SUPABASE_ANON_KEY
    );
});
