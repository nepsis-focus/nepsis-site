(function(){
  var card, textarea;
  function open(minutes){
    if(!card){card=document.createElement('aside');card.className='reflection-card';card.innerHTML='<button class="reflection-close" type="button" aria-label="Close">✕</button><span class="eyebrow">NEPSIS REFLECTION</span><h2 data-el="Πώς ήταν η συγκέντρωσή σου;" data-en="How did your focus feel?">Πώς ήταν η συγκέντρωσή σου;</h2><p data-el="Μία πρόταση αρκεί. Το κείμενο μένει μόνο στη συσκευή σου." data-en="One sentence is enough. This text stays only on your device.">Μία πρόταση αρκεί. Το κείμενο μένει μόνο στη συσκευή σου.</p><textarea aria-label="Reflection" placeholder="Τι παρατήρησες;"></textarea><div class="reflection-actions"><button class="btn btn-ghost" type="button" data-dismiss>Όχι τώρα</button><button class="btn btn-primary" type="button" data-save>Αποθήκευση τοπικά</button></div>';document.body.appendChild(card);textarea=card.querySelector('textarea');card.querySelector('.reflection-close').onclick=close;card.querySelector('[data-dismiss]').onclick=close;card.querySelector('[data-save]').onclick=function(){try{localStorage.setItem('nepsis-last-reflection',JSON.stringify({minutes:minutes,text:textarea.value,at:new Date().toISOString()}))}catch(e){}close()}}
    card.classList.add('open');textarea.value='';textarea.focus();
  }
  function close(){if(card)card.classList.remove('open')}
  window.addEventListener('nepsis:session-completed',function(e){open(e.detail&&e.detail.minutes||0)});
})();
