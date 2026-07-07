:root{
  --bg:#1B1816; --surface:#242019; --surface-2:#2D2820; --line:#3A332B;
  --accent:#C98A4B; --accent-soft:#E8C39E; --text:#F3ECE2; --text-muted:#9C9183;
  --ok:#8FA888; --warn:#C2685A;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0;}
html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;}
#app{display:flex;flex-direction:column;height:100vh;height:100dvh;}

/* ── HEADER ── */
header{
  display:flex;align-items:center;justify-content:space-between;
  padding:env(safe-area-inset-top,14px) 20px 12px;
  padding-top:max(env(safe-area-inset-top),14px);
  background:var(--surface);border-bottom:1px solid var(--line);flex-shrink:0;
  min-height:54px;
}
.brand-mark{font-family:'Fraunces',serif;font-size:20px;font-weight:600;color:var(--accent-soft);}
.stage-pill{
  font-size:11px;letter-spacing:1px;text-transform:uppercase;
  background:var(--surface-2);border:1px solid var(--line);
  padding:4px 10px;border-radius:20px;color:var(--text-muted);
}
.stage-pill b{color:var(--accent-soft);font-weight:600;}

main{flex:1;position:relative;overflow:hidden;}
.screen{position:absolute;inset:0;display:none;flex-direction:column;}
.screen.active{display:flex;}

/* ── BOTTOM NAV ── */
.bottom-nav{
  display:flex;background:var(--surface);border-top:1px solid var(--line);
  padding-bottom:env(safe-area-inset-bottom,0);flex-shrink:0;
}
.nav-tab{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:10px 4px;cursor:pointer;border:none;background:none;
  color:var(--text-muted);font-size:10px;letter-spacing:0.5px;
  transition:color .15s;
}
.nav-tab .icon{font-size:18px;}
.nav-tab.active{color:var(--accent-soft);}
.nav-tab:disabled{opacity:0.35;cursor:not-allowed;}

/* ── BUTTONS ── */
.btn{
  border:none;cursor:pointer;font-family:'Inter',sans-serif;font-weight:600;
  border-radius:12px;padding:13px 20px;font-size:14px;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  transition:transform .1s,opacity .15s;
}
.btn:active{transform:scale(0.97);}
.btn-primary{background:var(--accent);color:#1B1816;}
.btn-primary:disabled{background:var(--surface-2);color:var(--text-muted);cursor:not-allowed;}
.btn-ghost{background:transparent;color:var(--text-muted);border:1px solid var(--line);}

/* ── SCREEN 1: CAPTURE ── */
#screen-capture{background:var(--bg);}
.capture-video-wrap{
  flex:1;position:relative;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:#0a0907;
}
#video{width:100%;height:100%;object-fit:cover;display:block;}
.cam-off-msg{color:var(--text-muted);font-size:13px;text-align:center;padding:0 32px;line-height:1.8;position:absolute;}
#shotPreview{width:100%;height:100%;object-fit:cover;display:none;position:absolute;inset:0;}
.face-guide-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.cap-hint{
  position:absolute;bottom:14px;left:0;right:0;text-align:center;
  font-size:13px;color:var(--accent-soft);
  background:rgba(27,24,22,0.6);padding:6px;
}

/* angle strip */
.angle-strip{
  display:flex;gap:0;background:var(--surface);border-top:1px solid var(--line);
  flex-shrink:0;
}
.angle-item{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:8px 4px;cursor:pointer;position:relative;border-right:1px solid var(--line);
}
.angle-item:last-child{border-right:none;}
.angle-item.current::after{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);
}
.angle-thumb{
  width:36px;height:36px;border-radius:6px;
  background:var(--surface-2);overflow:hidden;display:flex;align-items:center;justify-content:center;
}
.angle-thumb img{width:100%;height:100%;object-fit:cover;}
.angle-name{font-size:10px;color:var(--text-muted);letter-spacing:0.5px;}
.angle-check{font-size:11px;color:var(--ok);}

.capture-actions{
  display:flex;gap:10px;padding:12px 16px;
  background:var(--surface);flex-shrink:0;
}
.shutter-btn{
  width:60px;height:60px;border-radius:50%;
  background:var(--accent);border:4px solid rgba(201,138,75,0.3);
  flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;
  font-size:20px;transition:transform .1s;align-self:center;
}
.shutter-btn:active{transform:scale(0.92);}
.cap-right{flex:1;display:flex;flex-direction:column;gap:8px;}
.dial-row{display:flex;align-items:center;gap:10px;}
.dial-mini{position:relative;width:44px;height:44px;flex-shrink:0;}
.dial-mini svg{width:100%;height:100%;}
.dial-mini-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--text-muted);}
.cap-hint-small{font-size:12px;color:var(--accent-soft);flex:1;}
.cap-btns{display:flex;gap:8px;}

/* ── SCREEN 2: STYLE ── */
#screen-style{overflow:hidden;}
.style-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 4px;}
.style-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
.style-card{
  background:var(--surface);border:1.5px solid var(--line);border-radius:14px;
  padding:12px;cursor:pointer;transition:border-color .15s,transform .1s;
  display:flex;flex-direction:column;gap:7px;
}
.style-card:active{transform:scale(0.98);}
.style-card.selected{border-color:var(--accent);}
.style-card.ai-recommended{border-color:var(--ok);}
.style-icon-box{height:80px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.style-card .name{font-size:13px;font-weight:600;}
.style-card .tags{font-size:10px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;}
.style-card .ai-rec{font-size:10px;color:var(--ok);display:none;}
.style-card.ai-recommended .ai-rec{display:block;}
.style-footer{display:flex;padding:10px 14px 14px;gap:8px;flex-shrink:0;}

/* ── SCREEN 3: ADJUST ── */
#screen-adjust{overflow:hidden;}
.adjust-preview{
  height:45vh;position:relative;overflow:hidden;flex-shrink:0;
  background:var(--surface);
}
.adjust-preview canvas{width:100%;height:100%;display:block;}
.preview-tag{
  position:absolute;top:10px;left:10px;
  background:rgba(27,24,22,0.75);backdrop-filter:blur(4px);
  padding:4px 10px;border-radius:8px;font-size:11px;color:var(--accent-soft);
}
.seg-status{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:11px;color:var(--text-muted);}
.debug-btn{
  position:absolute;right:10px;
  background:rgba(27,24,22,0.75);backdrop-filter:blur(4px);
  padding:4px 10px;border-radius:8px;font-size:11px;color:var(--accent-soft);
  border:1px solid var(--line);cursor:pointer;font-family:'JetBrains Mono',monospace;
}
.mask-debug-btn{top:10px;}
.mask-debug-btn.on{background:var(--accent);color:#1B1816;border-color:var(--accent);font-weight:600;}
.raw-debug-btn{top:46px;}
.raw-debug-btn.on{background:var(--accent);color:#1B1816;border-color:var(--accent);font-weight:600;}
.facebox-debug-btn{top:82px;}
.facebox-debug-btn.on{background:#00e5ff;color:#0A2A2E;border-color:#00e5ff;font-weight:600;}

.adjust-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 20px;}
.adjust-controls{display:flex;flex-direction:column;gap:14px;}

.angle-switch{display:flex;gap:5px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:4px;}
.angle-switch button{flex:1;background:transparent;border:none;color:var(--text-muted);padding:7px 0;font-size:11px;border-radius:7px;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.angle-switch button.on{background:var(--accent);color:#1B1816;font-weight:600;}

.ai-card{background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:12px 14px;}
.ai-card-hdr{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;color:var(--accent-soft);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
.ai-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;}
.ai-card-body{font-size:12px;color:var(--text-muted);line-height:1.7;margin-bottom:8px;}
.ai-tags{display:flex;flex-wrap:wrap;gap:5px;}
.ai-tag{font-size:10px;font-family:'JetBrains Mono',monospace;padding:3px 8px;border-radius:20px;background:var(--surface-2);border:1px solid var(--line);color:var(--accent-soft);}

.slider-block{display:flex;flex-direction:column;gap:7px;}
.slider-row{display:flex;justify-content:space-between;align-items:baseline;}
.slider-label{font-size:13px;font-weight:600;}
.slider-val{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent-soft);}
input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:var(--line);outline:none;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:var(--accent);cursor:pointer;border:3px solid var(--bg);}

.voice-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.voice-btn{display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border-radius:9px;background:var(--surface-2);transition:background .15s;}
.voice-btn.listening{background:var(--warn);}
.voice-dot{width:9px;height:9px;border-radius:50%;background:var(--text-muted);flex-shrink:0;}
.voice-btn.listening .voice-dot{background:#fff;animation:pulse 1s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
.voice-transcript{font-size:11px;color:var(--text-muted);line-height:1.5;}
.voice-transcript b{color:var(--accent-soft);font-weight:600;}
.voice-hints{font-size:10px;color:var(--text-muted);line-height:1.8;font-family:'JetBrains Mono',monospace;}

/* ── SCREEN 4: COMPARE ── */
#screen-compare{overflow:hidden;}
.compare-wrap{flex:1;position:relative;overflow:hidden;}
.compare-base{width:100%;height:100%;display:block;}
.compare-clip{position:absolute;top:0;bottom:0;left:0;overflow:hidden;width:50%;}
.compare-clip canvas{position:absolute;top:0;left:0;width:100%;height:100%;}
.compare-divider{position:absolute;top:0;bottom:0;width:3px;background:var(--accent);left:50%;transform:translateX(-50%);cursor:ew-resize;touch-action:none;}
.compare-divider::after{content:'◂▸';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--accent);color:#1B1816;font-size:10px;padding:5px 6px;border-radius:20px;letter-spacing:2px;}
.compare-label{position:absolute;top:10px;font-size:10px;letter-spacing:1px;padding:4px 9px;background:rgba(27,24,22,0.7);border-radius:7px;color:var(--text-muted);}
.compare-label.before{left:10px;}
.compare-label.after{right:10px;color:var(--accent-soft);}
.compare-bottom{padding:10px 14px 14px;display:flex;flex-direction:column;gap:8px;flex-shrink:0;}

/* ── OVERLAYS ── */
.toast{
  position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
  background:var(--surface-2);border:1px solid var(--line);
  padding:10px 18px;border-radius:12px;font-size:13px;
  opacity:0;pointer-events:none;transition:all .25s;z-index:50;
  white-space:nowrap;max-width:90vw;white-space:normal;text-align:center;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.ai-overlay{
  position:fixed;inset:0;background:rgba(27,24,22,0.92);z-index:100;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
  backdrop-filter:blur(6px);
}
.ai-overlay.hidden{display:none;}
.ai-spinner{width:40px;height:40px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.ai-overlay-text{font-size:14px;color:var(--accent-soft);}
.ai-overlay-sub{font-size:12px;color:var(--text-muted);}

::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:var(--line);border-radius:2px;}

/* ── SECTION TABS ── */
.section-tab{
  background:var(--surface);border:1.5px solid var(--line);border-radius:12px;
  overflow:hidden;transition:border-color .15s;
}
.section-tab.active{border-color:var(--accent);}
.section-tab-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px;cursor:pointer;
}
.section-tab-left{display:flex;align-items:center;gap:10px;}
.section-badge{
  font-size:9px;letter-spacing:1px;font-family:'JetBrains Mono',monospace;
  padding:3px 7px;border-radius:6px;
  background:var(--surface-2);color:var(--text-muted);border:1px solid var(--line);
}
.section-tab.active .section-badge{background:var(--accent);color:#1B1816;border-color:var(--accent);}
.section-tab-name{font-size:13px;font-weight:600;color:var(--text);}
.section-tab-desc{font-size:10px;color:var(--text-muted);}
.section-tab-summary{font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--accent-soft);}
.section-tab-body{
  padding:0 14px 14px;display:none;flex-direction:column;gap:12px;
  border-top:1px solid var(--line);padding-top:12px;
}
.section-tab.active .section-tab-body{display:flex;}
.param-label-row{display:flex;justify-content:space-between;align-items:baseline;}
.param-label{font-size:12px;color:var(--text-muted);}
.param-val{font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--accent-soft);}
.section-affects{font-size:10px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-top:2px;}
