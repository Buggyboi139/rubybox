window.AppSupabase = {
    client: null,
    initialized: false,

    init(url, anonKey) {
        if (this.initialized) return this.client;
        if (!url || !anonKey) {
            console.error('AppSupabase: Missing Supabase URL or anon key');
            return null;
        }
        if (typeof window.supabase === 'undefined') {
            console.error('AppSupabase: Supabase client not loaded');
            return null;
        }
        window.supabaseClient = window.supabase.createClient(url, anonKey);
        this.client = window.supabaseClient;
        this.initialized = true;
        return this.client;
    },

    getClient() {
        if (!this.initialized) {
            console.warn('AppSupabase: Client not initialized. Call AppSupabase.init() first.');
        }
        return this.client;
    },

    isReady() {
        return this.initialized && this.client !== null;
    }
};
