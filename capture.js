/* ════════════════════════════════════════
   AI ANALYSIS
════════════════════════════════════════ */
async function analyzeWithClaude(){
  const frontImg=state.shots['front']; if(!frontImg) return;
  showAI('AI가 얼굴을 분석하고 있어요…','얼굴형 · 머리색 · 스타일 추천');
  const base64=frontImg.split(',')[1];
  const mediaType=frontImg.startsWith('data:image/png')?'image/png':'image/jpeg';
  const prompt=`미용실 고객 정면 사진입니다. 아래 JSON만 응답하세요. 다른 텍스트 없이.
{
  "hairColor": "black|brown|blonde|red|grey|colored",
  "faceShape": "oval|round|square|heart|long",
  "currentLength": "short|medium|long",
  "recommendedStyles": ["id1","id2"],
  "advice": "한국어 2문장 이내 스타일 조언"
}
스타일 id 목록: bob, long-wave, pixie, layered, curly, sleek, shag, lob`;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:500,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:mediaType,data:base64}},
        {type:'text',text:prompt}
      ]}]})
    });
    const data=await res.json();
    const raw=data.content.map(b=>b.text||'').join('').replace(/```json|```/g,'').trim();
    aiAnalysis=JSON.parse(raw);
    document.querySelectorAll('.style-card').forEach(c=>c.classList.remove('ai-recommended'));
    (aiAnalysis.recommendedStyles||[]).forEach(id=>{
      const el=document.getElementById('style-'+id); if(el) el.classList.add('ai-recommended');
    });
    const faceMap={oval:'계란형',round:'둥근형',square:'각진형',heart:'하트형',long:'긴형'};
    const colorMap={black:'블랙',brown:'브라운',blonde:'블론드',red:'레드',grey:'그레이',colored:'컬러'};
    const lenMap={short:'숏',medium:'미디엄',long:'롱'};
    document.getElementById('aiAnalysisText').textContent=aiAnalysis.advice||'';
    const tags=[faceMap[aiAnalysis.faceShape]||'',colorMap[aiAnalysis.hairColor]||'',lenMap[aiAnalysis.currentLength]||''];
    document.getElementById('aiAnalysisTags').innerHTML=tags.filter(Boolean).map(t=>`<span class="ai-tag">${t}</span>`).join('');
    document.getElementById('aiAnalysisCard').style.display='flex';
  }catch(e){
    showToast('AI 분석 실패. 수동으로 조정해주세요.');
  }
  hideAI();
}

