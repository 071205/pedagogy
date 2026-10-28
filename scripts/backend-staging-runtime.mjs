// Serialized into the overlay's existing service-config.js; no extra public file.
export function stagingRuntime(config) {
  const f = config.firebase;
  const marker = 'PM_A0_PROFILE_V1';
  const identity = f.appId;
  let locked = false;
  let fresh = false;
  let admitted = false;
  function fail() { throw Error('A0 staging boundary rejected this operation'); }
  function profile() {
    const old = localStorage.getItem(marker);
    if ((old && old !== identity) || (!old && localStorage.length)) fail();
    return old;
  }
  function context() {
    if (locked || !admitted || location.origin !== config.origin) fail();
    if (localStorage.getItem(marker) !== identity) fail();
  }
  try {
    if (location.origin !== config.origin) fail();
    fresh = !profile();
  } catch { locked = true; }
  const ready = (async () => {
    if (locked || location.origin !== config.origin) fail();
    profile();
    if (typeof indexedDB.databases !== 'function') fail();
    const dbs = await indexedDB.databases();
    fresh = !profile(); // Another A0 tab may have admitted this profile during the await.
    if ((fresh && dbs.length) || dbs.some(d => !/^(firebase|PM_)/.test(d.name || ''))) fail();
    if (navigator.serviceWorker && (await navigator.serviceWorker.getRegistrations()).length) fail();
    // Do not leave an admission marker if navigation interrupts async checks.
    // Recheck storage after the await before declaring this profile ours.
    profile();
    localStorage.setItem(marker, identity);
    admitted = true;
    context();
  })().catch(() => { locked = true; });
  function allows(raw, method = 'GET') {
    if (locked || !admitted || location.origin !== config.origin) return false;
    let u;
    try { u = new URL(raw, location.href); } catch { return false; }
    if (u.username || u.password) return false;
    if(u.searchParams.getAll('key').length>1||u.searchParams.getAll('database').length>1)return false;
    if(u.searchParams.has('key')&&u.searchParams.get('key')!==f.apiKey)return false;
    if (u.origin === config.origin) return ['GET','HEAD'].includes(method.toUpperCase()) && !/^\/(health|render|hwpx|document-hwpx)(\/|$)/.test(u.pathname);
    if (u.protocol !== 'https:') return false;
    let path;
    try { path = decodeURIComponent(u.pathname); } catch { return false; }
    if(path.includes('\\')||path.split('/').some(p=>p==='..'||p==='.'))return false;
    if (u.hostname === 'firestore.googleapis.com') {
      const database = 'projects/' + f.projectId + '/databases/(default)';
      return path.startsWith('/v1/' + database + '/') || (/^\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel$/.test(path) && u.searchParams.get('database') === database);
    }
    if (['identitytoolkit.googleapis.com','securetoken.googleapis.com'].includes(u.hostname))
      return u.searchParams.get('key') === f.apiKey && /^\/v[123]\//.test(path);
    if (u.hostname === 'firebaseinstallations.googleapis.com') return path.startsWith('/v1/projects/' + f.projectId + '/installations');
    if (u.hostname === 'content-firebaseappcheck.googleapis.com') return method.toUpperCase() === 'POST' && u.searchParams.get('key') === f.apiKey && path === '/v1/projects/' + f.projectId + '/apps/' + f.appId + ':exchangeRecaptchaEnterpriseToken';
    if (u.hostname === 'recaptchaenterprise.googleapis.com') return path.startsWith('/v1/projects/' + f.projectId + '/');
    return false;
  }
  const nativeFetch = window.fetch;
  window.fetch = function(input, options) {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const method = options?.method || input?.method || 'GET';
    if (!allows(url, method)) return Promise.reject(Error('A0 network request blocked'));
    return nativeFetch.call(this, input, options);
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const requests = new WeakMap();
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    requests.set(this, {method, url:String(url)});
    return nativeOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const r = requests.get(this);
    if (!r || !allows(r.url, r.method)) fail();
    return nativeSend.apply(this, args);
  };
  function textOnly(value) {
    const visit = x => {
      if (!x || typeof x !== 'object') return;
      if (x.type === 'image' || x.intake || (typeof x.answerImg === 'string' && x.answerImg)) fail();
      for (const [key, v] of Object.entries(x)) {
        if ((key === 'dataUrl' && v) || (key === 'images' && JSON.stringify(v).replace(/[\[\]",\s]/g,''))) fail();
        if (typeof v === 'string' && /^(data:image\/|blob:|https:\/\/(firebasestorage|storage)\.googleapis\.com)/.test(v)) fail();
        if (v && typeof v === 'object') visit(v);
      }
    };
    visit(value);
  }
  // UI prevention supplements the write/transport entry guards, never replaces them.
  document.addEventListener('change', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
      e.preventDefault(); e.stopImmediatePropagation(); e.target.value = '';
    }
  }, true);
  document.addEventListener('drop', e => {
    if(e.dataTransfer?.files?.length){e.preventDefault();e.stopImmediatePropagation();}
  }, true);
  document.addEventListener('paste', e => {
    if ([...(e.clipboardData?.items || [])].some(x => x.kind === 'file')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    for (const input of document.querySelectorAll('input[type=file]')) input.disabled = true;
    for (const id of ['aiDropZone','aiImgInput','draftBtn','dmDelBtn']) {
      const node = document.getElementById(id); if (node) { node.disabled = true; node.title = 'A0에서는 지원하지 않습니다'; }
    }
    if (locked) {
      document.getElementById('a0StagingBanner')?.append(' · 차단됨: 새 빈 프로필과 지정 localhost 주소가 필요합니다');
      document.getElementById('loginBtn')?.setAttribute('disabled','');
    }
  });
  let bootstrapFinished=false;
  async function bootstrap() {
    await ready;
    try {
      context();
      // Preserve classic-script global scope and document order. No eval or
      // inline script injection: public scripts execute only after admission.
      for(const inert of document.querySelectorAll('script[type="application/x-a0-script"]')) {
        context();
        const source=inert.getAttribute('src');
        const script=document.createElement('script');
        script.async=false;
        for(const attr of ['src','integrity','crossorigin','referrerpolicy'])
          if(inert.hasAttribute(attr))script.setAttribute(attr,inert.getAttribute(attr));
        const loaded=await new Promise(resolve=>{
          const timer=setTimeout(()=>resolve(false),15000);
          script.onload=()=>{clearTimeout(timer);resolve(true);};
          script.onerror=()=>{clearTimeout(timer);resolve(false);};
          document.head.append(script);
        });
        if(!loaded&&new URL(source,location.href).origin===config.origin)fail();
      }
    }catch{
      locked=true;
      document.getElementById('loginBtn')?.setAttribute('disabled','');
      document.getElementById('a0StagingBanner')?.append(' · 초기화 차단: 새 빈 프로필과 검증된 산출물이 필요합니다');
    }finally{bootstrapFinished=true;}
  }
  window.PEDAGOGY_A0 = Object.freeze({ ready, assertContext: context, textOnly, allows,
    get bootstrapFinished(){return bootstrapFinished;} });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
  window.PEDAGOGY_PUBLIC_CONFIG = Object.freeze({ libraryCloudSchema:1, setRevisionSchema:1,
    mockCloudSchema:0, stagingBackendPreview:true, appCheckSiteKey:config.appCheckSiteKey,
    supportEmail:'', legalVersion:'', billingPortalUrl:'' });
}
