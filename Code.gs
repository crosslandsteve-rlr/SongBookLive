const FILE = 'songbook-data.json';
const FOLDER_ID = '0B2YsgGCjTTabT1hCWm12OGpSODA';          // your song folder
const IGNORE = /song ?list|set ?list|awards|nathans|^sets?\b/i; // files to skip
const cache = () => CacheService.getScriptCache();

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Songbook')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function isOwner_() {
  const a = Session.getActiveUser().getEmail();
  return !!a && a === Session.getEffectiveUser().getEmail();
}
function file_() {
  const it = DriveApp.getFilesByName(FILE);
  return it.hasNext() ? it.next() : DriveApp.createFile(FILE, '', 'application/json');
}
function state_() {
  const c = cache().get('state');
  if (c) return c;
  return file_().getBlob().getDataAsString() || null;
}
function getBoot() {
  return { owner: isOwner_(), state: state_(), view: cache().get('view') || '{}', ts: cache().get('ts') || '0' };
}
function getShared(clientTs) {
  const ts = cache().get('ts') || '0';
  return { ts: ts, view: cache().get('view') || '{}', state: ts !== clientTs ? state_() : null };
}
function saveState(json) {
  if (!isOwner_()) return;
  file_().setContent(json);
  try { cache().put('state', json, 21600); } catch (e) { cache().remove('state'); }
  cache().put('ts', String(Date.now()), 21600);
}
function saveView(json) {
  if (!isOwner_()) return;
  cache().put('view', json, 21600);
}
function walk_(folder, out) {
  const fs = folder.getFilesByType(MimeType.PDF);
  while (fs.hasNext()) { const f = fs.next(); out.push({ id: f.getId(), name: f.getName().replace(/\.pdf$/i, '') }); }
  const ds = folder.getFolders();
  while (ds.hasNext()) walk_(ds.next(), out);
}
function listSongs() {
  if (!isOwner_()) return [];
  const out = [];
  walk_(DriveApp.getFolderById(FOLDER_ID), out);
  const keep = out.filter(x => !IGNORE.test(x.name));
  cache().put('files', JSON.stringify(keep.map(x => x.id)), 21600);
  return keep;
}
function allowed_() {
  let c = cache().get('files');
  if (!c) {
    const out = []; walk_(DriveApp.getFolderById(FOLDER_ID), out);
    c = JSON.stringify(out.map(x => x.id));
    cache().put('files', c, 21600);
  }
  return new Set(JSON.parse(c));
}
// Only PDFs inside the song folder can be fetched.
function getPdf(id) {
  if (!allowed_().has(id)) throw new Error('Not available');
  return Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes());
}
