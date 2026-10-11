/** Encrypts OAuth tokens and other secrets before they are stored. */
export interface TokenCipher {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}
