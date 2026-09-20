/* Regression-only classic script, served from self so the production CSP can
   stay strict. Keep this explicit: adding a hook is a reviewable test action. */
window.__REGRESSION_HOOKS__ = {
  sanitize: typeof sanitize === "undefined" ? undefined : sanitize,
  MAX_UPLOAD_BYTES: typeof MAX_UPLOAD_BYTES === "undefined" ? undefined : MAX_UPLOAD_BYTES,
  AI_MAX_DIM: typeof AI_MAX_DIM === "undefined" ? undefined : AI_MAX_DIM,
  AI_QUALITY: typeof AI_QUALITY === "undefined" ? undefined : AI_QUALITY,
  setJSON: typeof setJSON === "undefined" ? undefined : setJSON,
  cloudSyncEntry: typeof cloudSyncEntry === "undefined" ? undefined : cloudSyncEntry,
  isCloudSynced: typeof isCloudSynced === "undefined" ? undefined : isCloudSynced,
  shouldUseCloudResult: typeof shouldUseCloudResult === "undefined" ? undefined : shouldUseCloudResult,
  storageCleanupComplete: typeof storageCleanupComplete === "undefined" ? undefined : storageCleanupComplete,
  storageCleanupMessage: typeof storageCleanupMessage === "undefined" ? undefined : storageCleanupMessage,
  planLabel: typeof planLabel === "undefined" ? undefined : planLabel,
  wiping: typeof wiping === "undefined" ? undefined : wiping,
  STORAGE_HOSTS: typeof STORAGE_HOSTS === "undefined" ? undefined : STORAGE_HOSTS,
  CHOICE_LAYOUTS: typeof CHOICE_LAYOUTS === "undefined" ? undefined : CHOICE_LAYOUTS,
  NOTICE_KINDS: typeof NOTICE_KINDS === "undefined" ? undefined : NOTICE_KINDS,
  BLOCK_TYPES: typeof BLOCK_TYPES === "undefined" ? undefined : BLOCK_TYPES,
  SUBJECTS: typeof SUBJECTS === "undefined" ? undefined : SUBJECTS,
  BLK_LABELS: typeof BLK_LABELS === "undefined" ? undefined : BLK_LABELS,
  blankBlockData: typeof blankBlockData === "undefined" ? undefined : blankBlockData,
  groupSpanOf: typeof groupSpanOf === "undefined" ? undefined : groupSpanOf,
  normLibMeta: typeof normLibMeta === "undefined" ? undefined : normLibMeta,
  t: typeof t === "undefined" ? undefined : t,
  UI_STRINGS: typeof UI_STRINGS === "undefined" ? undefined : UI_STRINGS,
  libSorted: typeof libSorted === "undefined" ? undefined : libSorted,
  libMeta: typeof libMeta === "undefined" ? undefined : libMeta,
  setToDoc: typeof setToDoc === "undefined" ? undefined : setToDoc,
  docToSet: typeof docToSet === "undefined" ? undefined : docToSet,
  mergeLibraryPrefs: typeof mergeLibraryPrefs === "undefined" ? undefined : mergeLibraryPrefs,
  $: typeof $ === "undefined" ? undefined : $,
  ICON: typeof ICON === "undefined" ? undefined : ICON,
  PAINT_HTML: typeof PAINT_HTML === "undefined" ? undefined : PAINT_HTML,
  PAINT_TYPST: typeof PAINT_TYPST === "undefined" ? undefined : PAINT_TYPST,
};
// Some tests replace the lexical object and then restore it. Resolve this one
// at access time so a later installHooks() observes the current value.
Object.defineProperty(window.__REGRESSION_HOOKS__, "libMeta", {
  configurable: true,
  get() { return typeof libMeta === "undefined" ? undefined : libMeta; },
});

window.__REGRESSION_ACTIONS__ = {
  menuLayerProbe() {
    const keep = sets;
    try {
      sets = Array.from({ length: 7 }, (_, i) => ({
        id: `__menu_${i}`, name: `메뉴 검사 ${i}`, header: "", subject: "math", problems: [],
      }));
      renderLibrary();
      const cards = [...document.querySelectorAll("#setGrid .set-card")];
      const card = cards[0];
      const dots = card.querySelector(".dotbtn");
      const menu = card.querySelector(".menu");
      dots.click();
      const lower = cards.find(item => item.getBoundingClientRect().top > card.getBoundingClientRect().top);
      const menuRect = menu.getBoundingClientRect();
      const lowerRect = lower && lower.getBoundingClientRect();
      return {
        opened: card.classList.contains("menu-open"),
        z: getComputedStyle(card).zIndex,
        overlap: !!lowerRect && menuRect.bottom > lowerRect.top,
      };
    } finally {
      sets = keep;
      renderLibrary();
    }
  },
  writeWhileWiping(mark) {
    const keep = sets;
    sets = [{ id: "__probe__", name: mark, header: "", problems: [] }];
    wiping = true;
    try { writeLocalNow(); } finally { wiping = false; sets = keep; }
  },
  syncProbe() {
    const keep = cloudSynced;
    try {
      const item = { id: "__sync_probe__", name: "x", header: "", problems: [], lineColor: "indigo", subject: "math" };
      cloudSynced = new Map([[item.id, cloudSyncEntry(item, 0)]]);
      return { same: isCloudSynced(item, 0), orderDirty: !isCloudSynced(item, 1) };
    } finally { cloudSynced = keep; }
  },
  deleteId(id) { deletedIds.delete(id); },
  libraryProbe() {
    const before = sets;
    try {
      sets = [
        { id: "__t1", name: "수학 것", subject: "math", header: "", problems: [] },
        { id: "__t2", name: "미지정", subject: "all", header: "", problems: [] },
      ];
      renderLibrary();
      const cards = [...document.querySelectorAll(".set-card")];
      const tag0 = cards[0] && cards[0].querySelector(".set-subj");
      const tag1 = cards[1] && cards[1].querySelector(".set-subj");
      return { n: cards.length, first: tag0 ? tag0.textContent : null, secondHasTag: !!tag1 };
    } finally { sets = before; renderLibrary(); }
  },
};
