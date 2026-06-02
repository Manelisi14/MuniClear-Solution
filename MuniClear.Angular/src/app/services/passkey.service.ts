import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PasskeyService {

  private base      = `${environment.apiUrl}/Auth/passkey`;
  private sessionId = crypto.randomUUID();

  constructor(private http: HttpClient) {}

  // ── Support checks ────────────────────────────────────────────────────────

  isSupported(): boolean {
    return !!(
      (window as any).PublicKeyCredential &&
      typeof navigator.credentials?.create === 'function' &&
      typeof navigator.credentials?.get    === 'function'
    );
  }

  async isPlatformAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      return await (PublicKeyCredential as any)
        .isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  // ── REGISTER a passkey (call AFTER normal login) ──────────────────────────

  async register(residentId: number, deviceLabel?: string): Promise<void> {
    const origin = window.location.origin;

    // 1. Get challenge from server
    const options: any = await firstValueFrom(
      this.http.post(`${this.base}/register-options`, { residentId, origin })
    );

    // 2. Build creation options
    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge:   base64UrlToBuffer(options.challenge),
      rp:          { id: options.rpId, name: options.rpName },
      user: {
        id:          base64UrlToBuffer(options.userId),
        name:        options.userName,
        displayName: options.userDisplayName
      },
      pubKeyCredParams:       options.pubKeyCredParams,
      timeout:                options.timeout,
      attestation:            options.attestation,
      authenticatorSelection: options.authenticatorSelection
    };

    // 3. Browser shows biometric prompt — cast via unknown to avoid TS error
    const raw = await navigator.credentials.create({ publicKey: publicKeyOptions });
    const credential = raw as unknown as PublicKeyCredential;

    if (!credential) throw new Error('Biometric registration was cancelled.');

    const response = credential.response as AuthenticatorAttestationResponse;
    const pubKey   = response.getPublicKey ? response.getPublicKey() : null;

    // 4. Send to server
    await firstValueFrom(
      this.http.post(`${this.base}/register`, {
        residentId,
        credentialId: bufferToBase64Url(credential.rawId),
        publicKey:    pubKey ? bufferToBase64Url(pubKey) : '',
        deviceLabel:  deviceLabel || getDeviceLabel()
      })
    );
  }

  // ── LOGIN with a passkey ──────────────────────────────────────────────────

  async login(): Promise<any> {
    const origin = window.location.origin;

    // 1. Get challenge
    const options: any = await firstValueFrom(
      this.http.post(`${this.base}/login-options`, {
        sessionId: this.sessionId,
        origin
      })
    );

    // 2. Build assertion options
    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge:        base64UrlToBuffer(options.challenge),
      rpId:             options.rpId,
      timeout:          options.timeout,
      userVerification: options.userVerification as UserVerificationRequirement
    };

    // 3. Browser shows biometric prompt — cast via unknown
    const raw = await navigator.credentials.get({ publicKey: publicKeyOptions });
    const assertion = raw as unknown as PublicKeyCredential;

    if (!assertion) throw new Error('Biometric login was cancelled.');

    const response  = assertion.response as AuthenticatorAssertionResponse;

    // Read sign count from bytes 33–36 of authenticator data
    const signCount = response.authenticatorData
      ? new DataView(response.authenticatorData).getUint32(33)
      : 0;

    // 4. Send assertion to server — get JWT back
    const result: any = await firstValueFrom(
      this.http.post(`${this.base}/login`, {
        sessionId:    this.sessionId,
        credentialId: bufferToBase64Url(assertion.rawId),
        signCount
      })
    );

    // 5. Store session exactly like normal JWT login
    localStorage.setItem('token',         result.token);
    localStorage.setItem('tokenExpiry',   result.expiresAt);
    localStorage.setItem('accountId',     result.accountId.toString());
    localStorage.setItem('userName',      result.userName);
    localStorage.setItem('accountNumber', result.accountNumber);

    return result;
  }

  // ── Manage passkeys (profile page) ───────────────────────────────────────

  getCredentials(residentId: number) {
    return this.http.get<any[]>(`${this.base}/list/${residentId}`);
  }

  deleteCredential(credentialId: number) {
    return this.http.delete(`${this.base}/${credentialId}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64UrlToBuffer(str: string): ArrayBuffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
    + '=='.slice(0, (4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary  = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '');
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / Face ID';
  if (/Android/i.test(ua))     return 'Android fingerprint';
  if (/Windows/i.test(ua))     return 'Windows Hello';
  if (/Mac/i.test(ua))         return 'MacBook Touch ID';
  return 'Device passkey';
}