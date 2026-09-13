/* PEDAGOGY AI 이미지 경계 — 전처리와 응답 문항 변환
 *
 * 고전 script라 `file://`에서도 실행한다. 이 파일은 DOM·fetch·Firebase·저장·사용자 상태를
 * 직접 읽지 않는다. 본체가 세 의존성을 주입해 이미지 변환과 신뢰 경계만 여기 둔다.
 */
(function(global){
  function required(deps, name){
    if(typeof deps?.[name] !== "function") throw new TypeError(`PedagogyAIImage requires ${name}`);
    return deps[name];
  }

  function create(deps){
    const fileToDataURL=required(deps, "fileToDataURL");
    const dataUrlToJpegBlob=required(deps, "dataUrlToJpegBlob");
    const normProblem=required(deps, "normProblem");

    const AI_MAX_DIM=1568, AI_QUALITY=0.8;
    const blobToBase64=blob=>new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(",")[1]);
      reader.onerror=()=>reject(new Error("이미지 변환 실패"));
      reader.readAsDataURL(blob);
    });

    async function prepImageForAI(file){
      const dataUrl=await fileToDataURL(file);
      const blob=await dataUrlToJpegBlob(dataUrl, AI_MAX_DIM, AI_QUALITY);
      if(blob) return { base64: await blobToBase64(blob), mimeType: "image/jpeg", bytes: blob.size };
      throw new Error("이 형식은 읽지 못했어요 · JPEG나 PNG로 저장한 뒤 다시 시도해 주세요");
    }

    function aiBlocksToProblem(problem){
      const raw=(problem&&Array.isArray(problem.blocks))?problem.blocks:[];
      const blocks=[];
      raw.forEach(block=>{
        if(!block||typeof block!=="object") return;
        const items=Array.isArray(block.items)?block.items.map(value=>String(value==null?"":value)):null;
        if(block.type==="statement"||block.type==="boxed"){
          blocks.push({type:block.type, data:{text:String(block.text==null?"":block.text)}});
        }else if(block.type==="conditions"||block.type==="examples"){
          blocks.push({type:block.type, data:{items:(items&&items.length)?items:[""]}});
        }else if(block.type==="choices"){
          const choices=(items||[]).slice(0,5);
          while(choices.length<5) choices.push("");
          blocks.push({type:"choices", data:{items:choices, layout:"horizontal"}});
        }
      });
      if(!blocks.length) blocks.push({type:"statement", data:{text:""}});
      return normProblem({ title:(problem&&problem.title)||"", desc:"", answer:"", answerImg:"",
                           numLabel:"", paired:false, blocks });
    }

    return Object.freeze({AI_MAX_DIM, AI_QUALITY, blobToBase64, prepImageForAI, aiBlocksToProblem});
  }

  global.PedagogyAIImage=Object.freeze({create});
})(typeof window!=="undefined" ? window : globalThis);
