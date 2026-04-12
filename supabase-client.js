const SUPABASE_URL = 'https://anpdzypxekvqprtaneol.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q-8Ja0YXlEm89Qv86v4V0g_I5xcDapT';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.AuthManager = (() => {
    let currentUser = null;

    async function checkSession() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        currentUser = session?.user || null;
        updateAuthUI();
        return currentUser;
    }

    async function login(email, password) {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        updateAuthUI();
        return currentUser;
    }

    async function signup(email, password) {
        const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        currentUser = data.user;
        updateAuthUI();
        return currentUser;
    }

    async function logout() {
        await window.supabaseClient.auth.signOut();
        currentUser = null;
        updateAuthUI();
        location.reload();
    }

    function updateAuthUI() {
        const loginBtn = document.getElementById('login-btn');
        const userInfo = document.getElementById('user-info');
        const emailDisplay = document.getElementById('user-email-display');

        if (currentUser) {
            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            emailDisplay.textContent = currentUser.email;
        } else {
            loginBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
            emailDisplay.textContent = '';
        }
    }

    return { checkSession, login, signup, logout, getCurrentUser: () => currentUser };
})();

document.addEventListener('DOMContentLoaded', () => {
    window.AuthManager.checkSession().then(user => {
        if(window.AppManager) window.AppManager.initialize(user);
    });

    document.getElementById('login-btn').addEventListener('click', () => {
        document.getElementById('authModal').classList.remove('hidden');
    });

    document.getElementById('closeAuthModal').addEventListener('click', () => {
        document.getElementById('authModal').classList.add('hidden');
    });

    document.getElementById('authLoginBtn').addEventListener('click', async () => {
        try {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const user = await window.AuthManager.login(email, pass);
            document.getElementById('authModal').classList.add('hidden');
            if(window.AppManager) window.AppManager.initialize(user);
        } catch(e) {
            alert(e.message);
        }
    });

    document.getElementById('authSignupBtn').addEventListener('click', async () => {
        try {
            const email = document.getElementById('authEmail').value;
            const pass = document.getElementById('authPassword').value;
            const user = await window.AuthManager.signup(email, pass);
            document.getElementById('authModal').classList.add('hidden');
            if(window.AppManager) window.AppManager.initialize(user);
        } catch(e) {
            alert(e.message);
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        window.AuthManager.logout();
    });
});
