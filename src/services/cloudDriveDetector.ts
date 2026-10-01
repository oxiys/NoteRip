/**
 * Cloud Drive Detector for NoteRip:
 * Accurately detects whether the current vault directory is located within
 * a recognized Cloud Drive service (Google Drive, Microsoft OneDrive, Dropbox,
 * iCloud Drive, Nextcloud, pCloud, MEGA, Box, Synology Drive).
 */

export interface CloudDriveInfo {
  isCloudDrive: boolean;
  provider: 'Google Drive' | 'OneDrive' | 'Dropbox' | 'iCloud' | 'Nextcloud' | 'pCloud' | 'MEGA' | 'Box' | 'Synology' | 'Cloud Drive' | null;
  providerShort: string;
  description: string;
}

export function detectCloudDrive(vaultPath: string | null | undefined): CloudDriveInfo {
  if (!vaultPath) {
    return {
      isCloudDrive: false,
      provider: null,
      providerShort: '',
      description: '',
    };
  }

  // Normalize path separators to forward slashes for unified cross-platform checking
  const normalized = vaultPath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();

  // 1. Google Drive (Virtual drives G:, H: or folder paths like "Google Drive", "My Drive", "Il mio Drive")
  if (
    lower.includes('google drive') ||
    lower.includes('googledrive') ||
    lower.includes('/my drive') ||
    lower.includes('/il mio drive') ||
    lower.includes('/drive condivisi') ||
    lower.includes('/shared drives') ||
    /^[gG]:\//.test(normalized) ||
    /^[gG]:$/.test(normalized.trim())
  ) {
    return {
      isCloudDrive: true,
      provider: 'Google Drive',
      providerShort: 'GDrive',
      description: 'Cartella sincronizzata in tempo reale tramite Google Drive',
    };
  }

  // 2. Microsoft OneDrive
  if (lower.includes('onedrive')) {
    return {
      isCloudDrive: true,
      provider: 'OneDrive',
      providerShort: 'OneDrive',
      description: 'Cartella sincronizzata in tempo reale tramite Microsoft OneDrive',
    };
  }

  // 3. Dropbox
  if (lower.includes('dropbox')) {
    return {
      isCloudDrive: true,
      provider: 'Dropbox',
      providerShort: 'Dropbox',
      description: 'Cartella sincronizzata in tempo reale tramite Dropbox',
    };
  }

  // 4. Apple iCloud Drive
  if (
    lower.includes('iclouddrive') ||
    lower.includes('icloud drive') ||
    lower.includes('com~apple~clouddocs') ||
    lower.includes('/mobile documents/')
  ) {
    return {
      isCloudDrive: true,
      provider: 'iCloud',
      providerShort: 'iCloud',
      description: 'Cartella sincronizzata in tempo reale tramite iCloud Drive',
    };
  }

  // 5. Nextcloud / ownCloud
  if (lower.includes('nextcloud') || lower.includes('owncloud')) {
    return {
      isCloudDrive: true,
      provider: 'Nextcloud',
      providerShort: 'Nextcloud',
      description: 'Cartella sincronizzata in tempo reale tramite Nextcloud',
    };
  }

  // 6. pCloud
  if (lower.includes('pcloud') || lower.includes('pcloud drive')) {
    return {
      isCloudDrive: true,
      provider: 'pCloud',
      providerShort: 'pCloud',
      description: 'Cartella sincronizzata in tempo reale tramite pCloud',
    };
  }

  // 7. MEGA
  if (lower.includes('megasync') || lower.includes('/mega/')) {
    return {
      isCloudDrive: true,
      provider: 'MEGA',
      providerShort: 'MEGA',
      description: 'Cartella sincronizzata in tempo reale tramite MEGA',
    };
  }

  // 8. Box
  if (lower.includes('box sync') || lower.includes('/box/')) {
    return {
      isCloudDrive: true,
      provider: 'Box',
      providerShort: 'Box',
      description: 'Cartella sincronizzata in tempo reale tramite Box',
    };
  }

  // 9. Synology Drive
  if (lower.includes('synologydrive') || lower.includes('synology drive')) {
    return {
      isCloudDrive: true,
      provider: 'Synology',
      providerShort: 'Synology',
      description: 'Cartella sincronizzata in tempo reale tramite Synology Drive',
    };
  }

  return {
    isCloudDrive: false,
    provider: null,
    providerShort: '',
    description: '',
  };
}
