import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class EncryptionService {
    private readonly key: Buffer;

    constructor(private readonly config: ConfigService) {
        const secret = this.config.get<string>('LLM_KEY_ENCRYPTION_SECRET');
        if (!secret || secret.length < 32) {
            throw new Error('LLM_KEY_ENCRYPTION_SECRET must be at least 32 characters');
        }
        // Derive a 32-byte key from the secret using SHA-256
        this.key = crypto.createHash('sha256').update(secret).digest();
    }

    encrypt(plaintext: string): string {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const authTag = cipher.getAuthTag();

        // Format: iv(16) + authTag(16) + ciphertext — all base64 encoded together
        const combined = Buffer.concat([iv, authTag, encrypted]);
        return combined.toString('base64');
    }

    decrypt(ciphertext: string): string {
        const combined = Buffer.from(ciphertext, 'base64');

        const iv = combined.subarray(0, IV_LENGTH);
        const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
        const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
        decipher.setAuthTag(authTag);

        return decipher.update(encrypted) + decipher.final('utf8');
    }

    maskKey(plaintext: string): string {
        if (plaintext.length <= 8) return '***';
        return plaintext.slice(0, 4) + '...' + plaintext.slice(-4);
    }
}
