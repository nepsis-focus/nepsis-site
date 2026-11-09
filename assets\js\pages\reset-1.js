(() => {
 const $=id=>document.getElementById(id);
 const phase=$('phase'),count=$('count'),timer=$('timer'),orb=$('orb'),progress=$('progress'),start=$('start');
 const total=120; let elapsed=0, interval=null, lang='el';
 const words={el:{ready:'Έτοιμος;',inhale:'Εισπνοή',exhale:'Εκπνοή',done:'Μπράβο. Πάρε τον χρόνο σου.',start:'Ξεκίνα',pause:'Παύση',resume:'Συνέχεια'},en:{ready:'Ready?',inhale:'Inhale',exhale:'Exhale',done:'Well done. Take your time.',start:'Start',pause:'Pause',resume:'Resume'}};
 const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
 function paint(){
   const left=Math.max(0,total-elapsed); timer.textContent=fmt(left); count.textContent=fmt(left); progress.style.width=(elapsed/total*100)+'%';
   if(elapsed>=total){phase.textContent=words[lang].done;orb.className='orb exhale';start.textContent=words[lang].start;return;}
   const cycle=elapsed%10,inhale=cycle<4;phase.textContent=elapsed===0?words[lang].ready:(inhale?words[lang].inhale:words[lang].exhale);orb.className='orb '+(inhale?'inhale':'exhale');
 }
 function stop(){if(interval){clearInterval(interval);interval=null;}}
 function tick(){if(elapsed>=total){stop();paint();return;}elapsed++;paint();if(elapsed>=total)stop();}
 start.addEventListener('click',()=>{if(interval){stop();start.textContent=words[lang].resume;return;}if(elapsed>=total)elapsed=0;start.textContent=words[lang].pause;interval=setInterval(tick,1000);});
 $('reset').addEventListener('click',()=>{stop();elapsed=0;start.textContent=words[lang].start;paint();});
 function setLang(next){lang=next;document.documentElement.lang=next;document.querySelectorAll('[data-el][data-en]').forEach(el=>{el.innerHTML=el.dataset[next];});document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===next));start.textContent=interval?words[lang].pause:(elapsed?words[lang].resume:words[lang].start);paint();}
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
 try{const saved=localStorage.getItem('nepsis-lang');if(saved==='en')setLang('en');}catch(e){}
 paint();
})();