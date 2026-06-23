/**
 * Sign-in with Google button.
 *
 * Uses Google Identity Services (GIS) loaded via the official script.
 * On click, opens the account chooser and posts the resulting id_token
 * to `/api/auth/google`. The gateway verifies the token, creates a user
 * in Neon if needed, sets the refresh cookie, and returns our own JWT.
 */

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '956122022786-na91u2fidvrd3h875q475vvj66ninvvu.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            opts: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
              logo_alignment?: 'left' | 'center';
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('GIS requires a browser'));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/** Initialize GIS and render the official "Sign in with Google" button. */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (credential: string) => Promise<void> | void,
) {
  await loadGisScript();
  if (!window.google) throw new Error('window.google not available after script load');
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (resp) => {
      await onCredential(resp.credential);
    },
  });
  window.google.accounts.id.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: 320,
    logo_alignment: 'left',
  });
}

export const GOOGLE_CLIENT_ID_PUBLIC = GOOGLE_CLIENT_ID;