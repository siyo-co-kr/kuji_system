import { StorageClient } from '@supabase/storage-js'
import { randomUUID } from 'crypto'

const BUCKET = 'kuji-images'

function getStorageClient() {
  const projectId = 'joslhrvkquydphlhfgiu'
  const supabaseUrl = process.env.SUPABASE_URL || `https://${projectId}.supabase.co`
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  return new StorageClient(`${supabaseUrl}/storage/v1`, {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  })
}

/**
 * Buffer をSupabase Storage にアップロードして公開 URL を返す
 */
export async function uploadImage(
  buffer: Buffer,
  mimeType: string,
  folder = 'uploads'
): Promise<string> {
  const storage = getStorageClient()
  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
  const path = `${folder}/${randomUUID()}.${ext}`

  const { error } = await storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
