// Thin wrapper around Supabase Storage for the document-upload flow.
//
// Why Supabase Storage:
//   - 1 GB free tier, no credit card required for signup.
//   - S3-like API surface (upload, signed URL, delete).
//   - Built-in CDN for downloads once you flip a bucket to public;
//     we keep ours PRIVATE and always serve via short-lived signed URLs.
//
// All errors here are surfaced to the caller; we don't swallow them. Callers
// in the document routes decide whether to fail the upload or fall back.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import logger from '../utils/logger';

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in the backend env',
    );
  }
  client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export interface UploadResult {
  path: string;
  bucket: string;
  size: number;
  contentType: string;
}

/**
 * Upload a file buffer to Supabase Storage.
 * @param path   object key, e.g. "<business_id>/<document_id>.pdf"
 * @param body   file contents (Buffer / Uint8Array)
 * @param contentType MIME type
 */
export async function uploadObject(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  const c = getClient();
  const { error } = await c.storage
    .from(config.supabaseBucket)
    .upload(path, body, {
      contentType,
      upsert: true,
      cacheControl: '3600',
    });
  if (error) {
    logger.error({ err: error, path }, 'Supabase upload failed');
    throw new Error(`Supabase upload failed: ${error.message}`);
  }
  return {
    path,
    bucket: config.supabaseBucket,
    size: body.byteLength,
    contentType,
  };
}

/**
 * Issue a short-lived signed URL so the browser can download the file
 * without ever seeing the service_role key.
 */
export async function getSignedUrl(path: string): Promise<string> {
  const c = getClient();
  const { data, error } = await c.storage
    .from(config.supabaseBucket)
    .createSignedUrl(path, config.supabaseSignedUrlTtlSeconds);
  if (error || !data) {
    logger.error({ err: error, path }, 'Supabase signed URL failed');
    throw new Error(`Supabase signed URL failed: ${error?.message ?? 'no data'}`);
  }
  return data.signedUrl;
}

/**
 * Download a file's bytes (used by ai-service and by /api/documents/download).
 */
export async function downloadObject(path: string): Promise<Buffer> {
  const c = getClient();
  const { data, error } = await c.storage
    .from(config.supabaseBucket)
    .download(path);
  if (error || !data) {
    logger.error({ err: error, path }, 'Supabase download failed');
    throw new Error(`Supabase download failed: ${error?.message ?? 'no data'}`);
  }
  // Supabase returns a Blob in Node >= 18.
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

/**
 * Delete an object. Best-effort — logs but does not throw on failure so a
 * dangling row cleanup doesn't block the request.
 */
export async function deleteObject(path: string): Promise<void> {
  try {
    const c = getClient();
    const { error } = await c.storage
      .from(config.supabaseBucket)
      .remove([path]);
    if (error) {
      logger.warn({ err: error, path }, 'Supabase delete failed');
    }
  } catch (err) {
    logger.warn({ err, path }, 'Supabase delete threw');
  }
}
