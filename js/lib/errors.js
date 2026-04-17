class AppError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

class AuthError extends AppError {
    constructor(message, code = 'AUTH_ERROR', statusCode = 401) {
        super(message, code, statusCode);
    }
}

class NotAuthenticatedError extends AuthError {
    constructor(message = 'User is not authenticated') {
        super(message, 'NOT_AUTHENTICATED', 401);
    }
}

class SessionExpiredError extends AuthError {
    constructor(message = 'Session has expired') {
        super(message, 'SESSION_EXPIRED', 401);
    }
}

class InvalidCredentialsError extends AuthError {
    constructor(message = 'Invalid email or password') {
        super(message, 'INVALID_CREDENTIALS', 401);
    }
}

class ServiceError extends AppError {
    constructor(message, code = 'SERVICE_ERROR', statusCode = 500) {
        super(message, code, statusCode);
    }
}

class ApiKeyMissingError extends ServiceError {
    constructor(message = 'API key is not available') {
        super(message, 'API_KEY_MISSING', 400);
    }
}

class NetworkError extends ServiceError {
    constructor(message = 'Network request failed', statusCode = 0) {
        super(message, 'NETWORK_ERROR', statusCode);
    }
}

class RateLimitError extends ServiceError {
    constructor(message = 'Rate limit exceeded', retryAfter = 60) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429);
        this.retryAfter = retryAfter;
    }
}

class StorageError extends AppError {
    constructor(message, code = 'STORAGE_ERROR', statusCode = 500) {
        super(message, code, statusCode);
    }
}

class UploadFailedError extends StorageError {
    constructor(message = 'File upload failed') {
        super(message, 'UPLOAD_FAILED', 500);
    }
}

class FileNotFoundError extends StorageError {
    constructor(message = 'File not found') {
        super(message, 'FILE_NOT_FOUND', 404);
    }
}

class ValidationError extends AppError {
    constructor(message, code = 'VALIDATION_ERROR', statusCode = 400) {
        super(message, code, statusCode);
    }
}

class InvalidInputError extends ValidationError {
    constructor(message = 'Invalid input provided') {
        super(message, 'INVALID_INPUT', 400);
    }
}

class MissingFieldError extends ValidationError {
    constructor(fieldName) {
        super(`Missing required field: ${fieldName}`, 'MISSING_FIELD', 400);
        this.fieldName = fieldName;
    }
}

class DatabaseError extends AppError {
    constructor(message, code = 'DATABASE_ERROR', statusCode = 500) {
        super(message, code, statusCode);
    }
}

class RecordNotFoundError extends DatabaseError {
    constructor(message = 'Record not found') {
        super(message, 'RECORD_NOT_FOUND', 404);
    }
}

class DuplicateRecordError extends DatabaseError {
    constructor(message = 'Record already exists') {
        super(message, 'DUPLICATE_RECORD', 409);
    }
}

class CryptoError extends AppError {
    constructor(message, code = 'CRYPTO_ERROR', statusCode = 500) {
        super(message, code, statusCode);
    }
}

class EncryptionFailedError extends CryptoError {
    constructor(message = 'Encryption operation failed') {
        super(message, 'ENCRYPTION_FAILED', 500);
    }
}

class DecryptionFailedError extends CryptoError {
    constructor(message = 'Decryption operation failed') {
        super(message, 'DECRYPTION_FAILED', 500);
    }
}

class InvalidPassphraseError extends CryptoError {
    constructor(message = 'Invalid passphrase') {
        super(message, 'INVALID_PASSPHRASE', 401);
    }
}

class ChatError extends AppError {
    constructor(message, code = 'CHAT_ERROR', statusCode = 500) {
        super(message, code, statusCode);
    }
}

class MessageSendError extends ChatError {
    constructor(message = 'Failed to send message') {
        super(message, 'MESSAGE_SEND_FAILED', 500);
    }
}

class ConversationNotFoundError extends ChatError {
    constructor(message = 'Conversation not found') {
        super(message, 'CONVERSATION_NOT_FOUND', 404);
    }
}

const ErrorHandlers = {
    wrapAsync(fn, errorCode = 'UNHANDLED_ERROR') {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                if (error instanceof AppError) {
                    throw error;
                }
                console.error(`[${errorCode}] Unhandled error:`, error);
                throw new AppError(
                    error.message || 'An unexpected error occurred',
                    errorCode,
                    500
                );
            }
        };
    },

    createResult(data, error) {
        return { data, error };
    },

    handleSupabaseError(supabaseError, defaultMessage = 'Database operation failed') {
        const code = supabaseError?.code || '';
        const message = supabaseError?.message || defaultMessage;

        switch (code) {
            case 'PGRST116':
                return new RecordNotFoundError(message);
            case 'PGRST126':
                return new DuplicateRecordError(message);
            case '23505':
                return new DuplicateRecordError(message);
            case '23503':
                return new ValidationError(message, 'FOREIGN_KEY_VIOLATION', 400);
            default:
                return new DatabaseError(message, code, 500);
        }
    },

    handleFetchError(error, defaultMessage = 'Network request failed') {
        if (error.name === 'AbortError') {
            return new ServiceError('Request was aborted', 'REQUEST_ABORTED', 0);
        }
        return new NetworkError(error.message || defaultMessage);
    }
};

window.AppErrors = {
    AppError,
    AuthError,
    NotAuthenticatedError,
    SessionExpiredError,
    InvalidCredentialsError,
    ServiceError,
    ApiKeyMissingError,
    NetworkError,
    RateLimitError,
    StorageError,
    UploadFailedError,
    FileNotFoundError,
    ValidationError,
    InvalidInputError,
    MissingFieldError,
    DatabaseError,
    RecordNotFoundError,
    DuplicateRecordError,
    CryptoError,
    EncryptionFailedError,
    DecryptionFailedError,
    InvalidPassphraseError,
    ChatError,
    MessageSendError,
    ConversationNotFoundError,
    ErrorHandlers
};
