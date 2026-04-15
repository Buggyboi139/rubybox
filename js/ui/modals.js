window.AppModals = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
        window.AppUI.sidebar?.classList.remove('show');
        window.AppUI.overlay?.classList.remove('show');
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    closeAll() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
    },

    toggleSidebar(show) {
        if (show) {
            window.AppUI.sidebar?.classList.add('show');
            window.AppUI.overlay?.classList.add('show');
        } else {
            window.AppUI.sidebar?.classList.remove('show');
            window.AppUI.overlay?.classList.remove('show');
        }
    },

    handleOverlayClick() {
        window.AppUI.sidebar?.classList.remove('show');
        window.AppUI.overlay?.classList.remove('show');
    }
};
