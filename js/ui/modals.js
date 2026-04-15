window.AppModals = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
        const ui = window.AppUI.get();
        ui.sidebar?.classList.remove('show');
        ui.overlay?.classList.remove('show');
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
        const ui = window.AppUI.get();
        if (show) {
            ui.sidebar?.classList.add('show');
            ui.overlay?.classList.add('show');
        } else {
            ui.sidebar?.classList.remove('show');
            ui.overlay?.classList.remove('show');
        }
    },

    handleOverlayClick() {
        const ui = window.AppUI.get();
        ui.sidebar?.classList.remove('show');
        ui.overlay?.classList.remove('show');
    }
};
