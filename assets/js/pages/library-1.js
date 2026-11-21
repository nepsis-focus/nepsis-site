(() => {
 let lang='el',active='all',saved=new Set();
 try{const stored=JSON.parse(localStorage.getItem('nepsis-saved-knowledge')||'[]');if(Array.isArray(stored))saved=new Set(stored.filter(x=>typeof x==='string'));}catch(e){}
 const WHOP_URL='https://whop.com/nepsis-focus';
 const WHOP_EL='Θέλεις το πλήρες εγχειρίδιο και τα εκτυπώσιμα τετράδια εργασίας; Δες τα μαθήματα στο Whop →';
 const WHOP_EN='Want the full handbook and printable workbooks? See the course on Whop →';
 const cards=[...document.querySelectorAll('.card')],search=document.getElementById('search'),empty=document.getElementById('empty');
 function updateSaveButton(card,button){const isSaved=saved.has(card.dataset.saveId);button.textContent=isSaved?(lang==='el'?'Αποθηκεύτηκε ★':'Saved ★'):(lang==='el'?'Αποθήκευση ☆':'Save ☆');button.setAttribute('aria-pressed',String(isSaved));button.setAttribute('aria-label',isSaved?(lang==='el'?'Αφαίρεση από τα αποθηκευμένα':'Remove from saved'):(lang==='el'?'Αποθήκευση άρθρου':'Save article'));}
 function attachWhopUpsell(card){
  if(card.querySelector('.whop-upsell'))return;
  const banner=document.createElement('div');
  banner.className='whop-upsell';
  const link=document.createElement('a');
  link.href=WHOP_URL;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.dataset.el=WHOP_EL;
  link.dataset.en=WHOP_EN;
  link.dataset.whopUpsell=card.dataset.saveId||'library_card';
  link.textContent=lang==='en'?WHOP_EN:WHOP_EL;
  banner.appendChild(link);
  card.appendChild(banner);
 }
 cards.forEach(card=>{const button=document.createElement('button');button.type='button';button.className='save-article';button.addEventListener('click',()=>{const id=card.dataset.saveId;if(saved.has(id))saved.delete(id);else{saved.add(id);if(window.nepsisAnalytics)window.nepsisAnalytics.track('library_saved',{item_id:id});}try{localStorage.setItem('nepsis-saved-knowledge',JSON.stringify([...saved]));}catch(e){}updateSaveButton(card,button);filter();});card.querySelector('.meta').append(button);updateSaveButton(card,button);attachWhopUpsell(card);});
 function filter(){const q=search.value.trim().toLocaleLowerCase();let visible=0;cards.forEach(card=>{const okCat=active==='all'||(active==='saved'?saved.has(card.dataset.saveId):card.dataset.category===active);const searchable=card.dataset.search+' '+[...card.querySelectorAll('h2,p,.try,.source')].map(el=>el.textContent).join(' ');const okText=!q||searchable.toLocaleLowerCase().includes(q);card.hidden=!(okCat&&okText);if(!card.hidden)visible++;});empty.hidden=visible!==0;}
 document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{active=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));filter();}));
 search.addEventListener('input',filter);search.addEventListener('change',()=>{if(window.nepsisAnalytics&&search.value.trim())window.nepsisAnalytics.track('library_searched',{section:'knowledge_library'});});
 function setLang(next){lang=next;document.documentElement.lang=next;document.querySelectorAll('[data-el][data-en]').forEach(el=>{el.innerHTML=el.dataset[next];});search.placeholder=search.dataset['placeholder'+(next==='el'?'El':'En')];document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===next));cards.forEach(card=>{const button=card.querySelector('.save-article');if(button)updateSaveButton(card,button);});filter();}
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
 try{if(localStorage.getItem('nepsis-lang')==='en')setLang('en');}catch(e){}
 filter();
})();