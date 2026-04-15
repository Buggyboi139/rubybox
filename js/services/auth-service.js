window.AppAuthService = {
    async checkSession() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const user = session?.user || null;
            window.AppState.setUser(user);
            this._updateUI(user);
            return user;
        } catch (e) {
            console.error('Session check error:', e);
            return null;
        }
    },

    async login(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            window.AppState.setUser(data.user);
            this._updateUI(data.user);
            return data.user;
        } catch (e) {
            console.error('Login error:', e);
            throw e;
        }
    },

    async signup(email, password) {
        try {
            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password
            });
            if (error) throw error;
            window.AppState.setUser(data.user);
            this._updateUI(data.user);
            return data.user;
        } catch (e) {
            console.error('Signup error:', e);
            throw e;
        }
    },

    async logout() {
        try {
            await window.supabaseClient.auth.signOut();
            window.AppState.setUser(null);
            window.AppState.reset();
            this._updateUI(null);
            location.reload();
        } catch (e) {
            console.error('Logout error:', e);
        }
    },

    _updateUI(user) {
        const ui = window.AppUI.get();
        if (!ui) return;

        if (user) {
            ui.loginBtn?.classList.add('hidden');
            ui.userInfo?.classList.remove('hidden');
            ui.emailDisplay.textContent = user.email;
        } else {
            ui.loginBtn?.classList.remove('hidden');
            ui.userInfo?.classList.add('hidden');
            ui.emailDisplay.textContent = '';
        }
    },

    getCurrentUser() {
        return window.AppState.get('user');
    },

    isAuthenticated() {
        return !!window.AppState.get('user');
    }
};
