import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required')
}

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long')
}

/**
 * Encrypts a string using AES-256
 */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

/**
 * Decrypts a string that was encrypted with AES-256
 */
export function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

/**
 * Encrypts OAuth tokens before storing in database
 */
export function encryptToken(token: string): string {
  if (!token) {
    throw new Error('Token cannot be empty')
  }
  return encrypt(token)
}

/**
 * Decrypts OAuth tokens when retrieving from database
 */
export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error('Encrypted token cannot be empty')
  }

  try {
    const decrypted = decrypt(encryptedToken)
    if (!decrypted) {
      throw new Error('Failed to decrypt token')
    }
    return decrypted
  } catch (error) {
    throw new Error('Invalid encrypted token or wrong encryption key')
  }
}

/**
 * Safely encrypts data, handling null/undefined values
 */
export function safeEncrypt(data: string | null | undefined): string | null {
  if (!data) return null
  return encrypt(data)
}

/**
 * Safely decrypts data, handling null/undefined values
 */
export function safeDecrypt(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null
  return decryptToken(encryptedData)
}

/**
 * Generates a random encryption key (32 characters)
 * Use this to generate the ENCRYPTION_KEY environment variable
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString()
}

/**
 * Validates that the encryption key is properly configured
 */
export function validateEncryptionKey(): boolean {
  try {
    const testData = 'test_encryption'
    const encrypted = encrypt(testData)
    const decrypted = decrypt(encrypted)
    return decrypted === testData
  } catch (error) {
    return false
  }
}