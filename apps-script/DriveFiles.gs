const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = {
  'image/png': true,
  'image/jpeg': true,
  'image/jpg': true,
  'image/gif': true,
  'image/webp': true,
  'image/heic': true,
  'image/heif': true,
  'application/pdf': true
};

function ensureDriveFolders_(schoolName) {
  let rootId = setting_('drive_folder_id', '');
  let root;
  if (rootId) {
    try { root = DriveApp.getFolderById(rootId); } catch (err) { root = null; }
  }
  if (!root) {
    root = DriveApp.createFolder((schoolName || '학교') + '_QR보안점검표');
    setSetting_('drive_folder_id', root.getId());
  }

  const uploadId = ensureChildFolderSetting_(root, 'uploads_folder_id', 'uploads');
  const exportId = ensureChildFolderSetting_(root, 'exports_folder_id', 'exports');
  return { drive_folder_id: root.getId(), uploads_folder_id: uploadId, exports_folder_id: exportId };
}

function ensureChildFolderSetting_(root, settingKey, childName) {
  let id = setting_(settingKey, '');
  if (id) {
    try { return DriveApp.getFolderById(id).getId(); } catch (err) {}
  }
  const folder = root.createFolder(childName);
  setSetting_(settingKey, folder.getId());
  return folder.getId();
}

function uploadAttachment_(recordId, itemKey, filePayload) {
  const row = createAttachmentFile_(recordId, itemKey, filePayload);
  if (row) appendObject_('attachments', row);
  return row;
}

function createAttachmentFile_(recordId, itemKey, filePayload) {
  if (!filePayload || !filePayload.base64) return null;
  const checked = validateAttachmentPayload_(filePayload);
  const mimeType = checked.mimeType;
  const bytes = checked.bytes;
  const date = new Date();
  const yyyy = Utilities.formatDate(date, TIMEZONE, 'yyyy');
  const mm = Utilities.formatDate(date, TIMEZONE, 'MM');
  const uploadRoot = DriveApp.getFolderById(setting_('uploads_folder_id', ensureDriveFolders_(setting_('school_name', '학교')).uploads_folder_id));
  const yearFolder = getOrCreateChild_(uploadRoot, yyyy);
  const monthFolder = getOrCreateChild_(yearFolder, mm);
  const safeName = safeFileName_((recordId + '_' + itemKey + '_' + (filePayload.file_name || filePayload.name || 'attachment')).slice(0, 180));
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const file = monthFolder.createFile(blob);
  return {
    attachment_id: uuid_('att'),
    record_id: recordId,
    item_key: itemKey,
    file_name: safeName,
    mime_type: mimeType,
    file_size: bytes.length,
    drive_file_id: file.getId(),
    drive_url: file.getUrl(),
    created_at: nowIso_()
  };
}

function validateAttachmentPayload_(filePayload) {
  const mimeType = String(filePayload.mime_type || filePayload.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME[mimeType]) throw new Error('허용되지 않는 파일 형식입니다: ' + mimeType);
  const base64 = String(filePayload.base64 || '');
  if (base64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 128) {
    throw new Error('파일은 5MB 이하만 업로드할 수 있습니다.');
  }
  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('파일은 5MB 이하만 업로드할 수 있습니다.');
  if (!matchesMimeSignature_(bytes, mimeType)) {
    throw new Error('파일 내용과 형식이 일치하지 않습니다: ' + mimeType);
  }
  return { mimeType: mimeType, bytes: bytes };
}

function matchesMimeSignature_(bytes, mimeType) {
  if (mimeType === 'application/pdf') return startsWithBytes_(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (mimeType === 'image/png') return startsWithBytes_(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return startsWithBytes_(bytes, [0xff, 0xd8, 0xff]);
  if (mimeType === 'image/gif') return asciiFromBytes_(bytes, 0, 6) === 'GIF87a' || asciiFromBytes_(bytes, 0, 6) === 'GIF89a';
  if (mimeType === 'image/webp') return asciiFromBytes_(bytes, 0, 4) === 'RIFF' && asciiFromBytes_(bytes, 8, 4) === 'WEBP';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    const majorBrand = asciiFromBytes_(bytes, 8, 4);
    return asciiFromBytes_(bytes, 4, 4) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'heif', 'mif1', 'msf1'].indexOf(majorBrand) >= 0;
  }
  return false;
}

function startsWithBytes_(bytes, expected) {
  if (!bytes || bytes.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if ((bytes[i] < 0 ? bytes[i] + 256 : bytes[i]) !== expected[i]) return false;
  }
  return true;
}

function asciiFromBytes_(bytes, start, length) {
  if (!bytes || bytes.length < start + length) return '';
  let text = '';
  for (let i = start; i < start + length; i++) {
    text += String.fromCharCode(bytes[i] < 0 ? bytes[i] + 256 : bytes[i]);
  }
  return text;
}

function getOrCreateChild_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function safeFileName_(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|#%{}~&]/g, '_');
}
