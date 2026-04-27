const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = {
  'image/png': true,
  'image/jpeg': true,
  'image/jpg': true,
  'image/gif': true,
  'image/webp': true,
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
  if (!filePayload || !filePayload.base64) return null;
  const mimeType = String(filePayload.mime_type || filePayload.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME[mimeType]) throw new Error('허용되지 않는 파일 형식입니다: ' + mimeType);
  const bytes = Utilities.base64Decode(filePayload.base64);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('파일은 5MB 이하만 업로드할 수 있습니다.');
  const date = new Date();
  const yyyy = Utilities.formatDate(date, TIMEZONE, 'yyyy');
  const mm = Utilities.formatDate(date, TIMEZONE, 'MM');
  const uploadRoot = DriveApp.getFolderById(setting_('uploads_folder_id', ensureDriveFolders_(setting_('school_name', '학교')).uploads_folder_id));
  const yearFolder = getOrCreateChild_(uploadRoot, yyyy);
  const monthFolder = getOrCreateChild_(yearFolder, mm);
  const safeName = safeFileName_((recordId + '_' + itemKey + '_' + (filePayload.file_name || filePayload.name || 'attachment')).slice(0, 180));
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const file = monthFolder.createFile(blob);
  const row = {
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
  appendObject_('attachments', row);
  return row;
}

function getOrCreateChild_(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function safeFileName_(name) {
  return String(name || 'file').replace(/[\\/:*?"<>|#%{}~&]/g, '_');
}

