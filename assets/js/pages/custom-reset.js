/* Return from the reset page to the next custom focus block after the planned break. */
(function(){
  "use strict";
  const params=new URLSearchParams(window.location.search);
  const next=params.get("customNext");
  if(!next)return;
  try{
    const url=new URL(next,window.location.href);if(url.origin!==window.location.origin)return;
    const main=document.querySelector("main");if(!main)return;
    let lang=document.documentElement.lang;try{lang=localStorage.getItem("nepsis-lang")||lang;}catch(e){}
    const until=Number(params.get("customBreakUntil"))||0;
    const card=document.createElement("section");card.className="card custom-reset-return";card.style.margin="22px auto";card.style.padding="22px";card.style.maxWidth="680px";
    const title=document.createElement("h2");title.textContent=lang==="en"?"Your focus session is ready":"Η συνεδρία συγκέντρωσης σε περιμένει";
    const note=document.createElement("p");note.textContent=lang==="en"?"Your planned break is in progress. The next focus block will unlock when it ends.":"Το προγραμματισμένο διάλειμμα βρίσκεται σε εξέλιξη. Το επόμενο μπλοκ συγκέντρωσης θα είναι διαθέσιμο όταν ολοκληρωθεί.";
    const countdown=document.createElement("strong");countdown.className="custom-break-count";countdown.style.display="block";countdown.style.margin="12px 0";
    const link=document.createElement("a");link.className="btn primary";link.href=url.href;link.textContent=lang==="en"?"Continue the custom session":"Συνέχισε την προσαρμοσμένη συνεδρία";link.hidden=true;
    card.append(title,note,countdown,link);main.appendChild(card);
    function render(){
      const seconds=Math.max(0,Math.ceil((until-Date.now())/1000));
      countdown.textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
      if(seconds===0){note.textContent=lang==="en"?"Your break is complete. Continue when you are ready.":"Το διάλειμμα ολοκληρώθηκε. Συνέχισε όταν είσαι έτοιμος.";countdown.hidden=true;link.hidden=false;window.clearInterval(timer);}
    }
    if(!until||until<=Date.now()){countdown.hidden=true;link.hidden=false;note.textContent=lang==="en"?"Your break is complete. Continue when you are ready.":"Το διάλειμμα ολοκληρώθηκε. Συνέχισε όταν είσαι έτοιμος.";}
    else{render();const timer=window.setInterval(render,1000);}
  }catch(e){}
})();