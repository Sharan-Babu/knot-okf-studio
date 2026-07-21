import { app, safeStorage } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { writeFileAtomically } from './atomic-file'

interface VaultFile {
  version: 1
  secrets: Record<string, string>
}

function vaultPath(): string {
  return path.join(app.getPath('userData'), 'knot-secrets.json')
}

async function readVault(): Promise<VaultFile> {
  try {
    const value = JSON.parse(await readFile(vaultPath(), 'utf8')) as Partial<VaultFile>
    return { version: 1, secrets: value.secrets ?? {} }
  } catch {
    return { version: 1, secrets: {} }
  }
}

async function writeVault(value: VaultFile): Promise<void> {
  await writeFileAtomically(vaultPath(), JSON.stringify(value), { encoding: 'utf8', mode: 0o600 })
}

export function vaultProtectionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export async function getSecret(id: string): Promise<string | null> {
  if (id === 'daytona-api-key' && process.env.KNOT_TEST_DAYTONA_API_KEY) {
    return process.env.KNOT_TEST_DAYTONA_API_KEY
  }
  if (id === 'parallel-api-key' && process.env.KNOT_TEST_PARALLEL_API_KEY) {
    return process.env.KNOT_TEST_PARALLEL_API_KEY
  }
  if (!vaultProtectionAvailable()) return null
  const encrypted = (await readVault()).secrets[id]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}

export async function setSecret(id: string, secret: string): Promise<void> {
  if (!vaultProtectionAvailable()) {
    throw new Error('Secure operating-system credential storage is unavailable on this device.')
  }
  const vault = await readVault()
  vault.secrets[id] = safeStorage.encryptString(secret).toString('base64')
  await writeVault(vault)
}

export async function removeSecret(id: string): Promise<void> {
  const vault = await readVault()
  if (!(id in vault.secrets)) return
  delete vault.secrets[id]
  await writeVault(vault)
}

export async function hasSecret(id: string): Promise<boolean> {
  return Boolean(await getSecret(id))
}
