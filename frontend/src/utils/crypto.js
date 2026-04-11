/**
 * Client-side encryption using Web Crypto API.
 * AES-256-GCM for data, RSA-OAEP for key wrapping.
 * Raw genomic data never leaves the browser unencrypted.
 */

export async function encryptFile(fileBytes, rsaPublicKeyPem) {
  // 1. Generate random AES-256 key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )

  // 2. Encrypt file bytes with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileBytes
  )

  // 3. Export raw AES key
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey)

  // 4. Import RSA public key
  const rsaKey = await importRsaPublicKey(rsaPublicKeyPem)

  // 5. Wrap AES key with RSA-OAEP
  const wrappedKey = await crypto.subtle.wrapKey('raw', aesKey, rsaKey, {
    name: 'RSA-OAEP'
  })

  // 6. Return encrypted blob (iv + ciphertext) and wrapped key (base64)
  const ivAndData = new Uint8Array(iv.length + encryptedData.byteLength)
  ivAndData.set(iv, 0)
  ivAndData.set(new Uint8Array(encryptedData), iv.length)

  return {
    encryptedBlob: ivAndData,
    encryptedAesKey: arrayBufferToBase64(wrappedKey),
  }
}

async function importRsaPublicKey(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['wrapKey']
  )
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}
