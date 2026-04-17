window.AppStorageService = {
    BUCKET_NAME: 'chat_images',

    async uploadImage(base64Data, prefix = 'chat') {
        try {
            const user = window.AppState.get('user');
            if (!user) {
                const error = new window.AppErrors.NotAuthenticatedError();
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            if (!base64Data || typeof base64Data !== 'string') {
                const error = new window.AppErrors.InvalidInputError('Image data must be a non-empty string');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const blob = await this._fetchBlob(base64Data);
            const fileName = this._generateFileName(prefix, user.id);

            const { data, error: uploadError } = await window.supabaseClient.storage
                .from(this.BUCKET_NAME)
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600'
                });

            if (uploadError) {
                const error = new window.AppErrors.UploadFailedError(uploadError.message);
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const publicUrl = this.getPublicUrl(fileName);
            return window.AppErrors.ErrorHandlers.createResult(publicUrl, null);

        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }
            console.error('[StorageService] Image upload error:', error);
            const appError = new window.AppErrors.UploadFailedError(error.message);
            return window.AppErrors.ErrorHandlers.createResult(null, appError);
        }
    },

    async uploadGeneratedImage(blob, prefix = 'gen') {
        try {
            const user = window.AppState.get('user');
            if (!user) {
                const error = new window.AppErrors.NotAuthenticatedError();
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            if (!blob || !(blob instanceof Blob)) {
                const error = new window.AppErrors.InvalidInputError('Blob must be a valid Blob object');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const fileName = this._generateFileName(prefix, user.id);

            const { error: uploadError } = await window.supabaseClient.storage
                .from(this.BUCKET_NAME)
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600'
                });

            if (uploadError) {
                const error = new window.AppErrors.UploadFailedError(uploadError.message);
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const publicUrl = this.getPublicUrl(fileName);
            return window.AppErrors.ErrorHandlers.createResult(publicUrl, null);

        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }
            console.error('[StorageService] Generated image upload error:', error);
            const appError = new window.AppErrors.UploadFailedError(error.message);
            return window.AppErrors.ErrorHandlers.createResult(null, appError);
        }
    },

    async deleteImage(fileName) {
        try {
            if (!fileName || typeof fileName !== 'string') {
                const error = new window.AppErrors.InvalidInputError('Filename must be a non-empty string');
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            const { error: deleteError } = await window.supabaseClient.storage
                .from(this.BUCKET_NAME)
                .remove([fileName]);

            if (deleteError) {
                const error = new window.AppErrors.StorageError(deleteError.message);
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }

            return window.AppErrors.ErrorHandlers.createResult(null, null);

        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                return window.AppErrors.ErrorHandlers.createResult(null, error);
            }
            console.error('[StorageService] Image delete error:', error);
            const appError = new window.AppErrors.StorageError(error.message);
            return window.AppErrors.ErrorHandlers.createResult(null, appError);
        }
    },

    getPublicUrl(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            console.warn('[StorageService] Invalid filename for URL generation');
            return '';
        }

        const { data } = window.supabaseClient.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(fileName);
        
        return data?.publicUrl || '';
    },

    async _fetchBlob(dataUrl) {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new window.AppErrors.NetworkError(`Failed to fetch image: ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            if (error instanceof window.AppErrors.AppError) {
                throw error;
            }
            throw new window.AppErrors.NetworkError('Failed to fetch image data');
        }
    },

    _generateFileName(prefix, userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${userId}_${timestamp}_${random}.jpg`;
    }
};
