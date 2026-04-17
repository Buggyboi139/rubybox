window.AppAuthService = {
    async checkSession() {
        try {
            const { data: { session }, error } = await window.supabaseClient.auth.getSession();
            
            if (error) {
                console.error('[AuthService] Session check error:', error.message);
                window.AppState.setUser(null);
                this._updateUI(null);
                return null;
            }
            
            const user = session?.user || null;
            window.AppState.setUser(user);
            this._updateUI(user);
            return user;
            
        } catch (e) {
            console.error('[AuthService] Unexpected session check error:', e);
            window.AppState.setUser(null);
            this._updateUI(null);
            return null;
        }
    },

    async login(email, password) {
        try {
            const validation = window.AppValidation.validateRequiredFields(
                { email, password },
                ['email', 'password']
            );
            
            if (!validation.valid) {
                const error = new window.AppErrors.MissingFieldError(validation.missingFields.join(', '));
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }
            
            if (!window.AppValidation.isValidEmail(email)) {
                const error = new window.AppErrors.InvalidInputError('Invalid email format');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const { data, error: supabaseError } = await window.supabaseClient.auth.signInWithPassword({
                email: email.trim(),
                password
            });

            if (supabaseError) {
                const error = this._mapAuthError(supabaseError);
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            window.AppState.setUser(data.user);
            this._updateUI(data.user);
            return window.AppErrors.ErrorHandlers.createResult(data.user, null);
            
        } catch (e) {
            console.error('[AuthService] Login error:', e);
            const error = new window.AppErrors.AuthError(e.message || 'Login failed');
            return window.AppErrors.ErrorHandlers.createResult(null, error);
        }
    },

    async signup(email, password) {
        try {
            const validation = window.AppValidation.validateRequiredFields(
                { email, password },
                ['email', 'password']
            );
            
            if (!validation.valid) {
                const error = new window.AppErrors.MissingFieldError(validation.missingFields.join(', '));
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }
            
            if (!window.AppValidation.isValidEmail(email)) {
                const error = new window.AppErrors.InvalidInputError('Invalid email format');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            if (password.length < 6) {
                const error = new window.AppErrors.InvalidInputError('Password must be at least 6 characters');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const { data, error: supabaseError } = await window.supabaseClient.auth.signUp({
                email: email.trim(),
                password
            });

            if (supabaseError) {
                const error = this._mapAuthError(supabaseError);
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            window.AppState.setUser(data.user);
            this._updateUI(data.user);
            return window.AppErrors.ErrorHandlers.createResult(data.user, null);
            
        } catch (e) {
            console.error('[AuthService] Signup error:', e);
            const error = new window.AppErrors.AuthError(e.message || 'Signup failed');
            return window.AppErrors.ErrorHandlers.createResult(null, error);
        }
    },

    async logout() {
        try {
            const { error } = await window.supabaseClient.auth.signOut();
            
            if (error) {
                console.error('[AuthService] Logout error:', error.message);
            }
            
        } catch (e) {
            console.error('[AuthService] Unexpected logout error:', e);
        } finally {
            window.AppState.setUser(null);
            window.AppState.reset();
            this._updateUI(null);
            location.reload();
        }
    },

    getCurrentUser() {
        return window.AppState.get('user');
    },

    isAuthenticated() {
        return !!window.AppState.get('user');
    },

    _mapAuthError(supabaseError) {
        const code = supabaseError?.code || '';
        const message = supabaseError?.message || 'Authentication failed';

        switch (code) {
            case 'invalid_credentials':
            case 'invalid_grant':
                return new window.AppErrors.InvalidCredentialsError();
            case 'user_already_exists':
            case 'email_address_taken':
                return new window.AppErrors.DuplicateRecordError('An account with this email already exists');
            case 'weak_password':
                return new window.AppErrors.ValidationError(message, 'WEAK_PASSWORD', 400);
            case 'over_request_rate_limit':
            case 'over_email_send_rate_limit':
                return new window.AppErrors.RateLimitError('Too many requests. Please try again later.');
            case 'user_not_found':
                return new window.AppErrors.InvalidCredentialsError();
            default:
                return new window.AppErrors.AuthError(message);
        }
    },

    _updateUI(user) {
        try {
            const ui = window.AppUI.get();
            if (!ui) return;

            if (user) {
                ui.loginBtn?.classList.add('hidden');
                ui.userInfo?.classList.remove('hidden');
                if (ui.emailDisplay) {
                    ui.emailDisplay.textContent = user.email || '';
                }
            } else {
                ui.loginBtn?.classList.remove('hidden');
                ui.userInfo?.classList.add('hidden');
                if (ui.emailDisplay) {
                    ui.emailDisplay.textContent = '';
                }
            }
        } catch (e) {
            console.error('[AuthService] UI update error:', e);
        }
    }
};
