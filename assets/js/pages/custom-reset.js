/* Return from the reset page to the next custom focus block. */
(function(){
  "use strict";
  const params=new URLSearchParams(window.location.search);
  const next=params.get("customNext");
  if(!next)return;
  try{const url=new URL(next,window.location.href);if(url.origin!==window.location.origin)return;
    const main=document.querySelector("main");if(!main)return;
    const card=document.createElement("section");card.className="card custom-reset-return";card.style.margin="22px auto";card.style.padding="22px";card.style.maxWidth="680px";
    const title=document.createElement("h2");title.textContent=document.documentElement.lang==="en"?"Your focus session is ready":"Η συνεδρία συγκέντρωσης σε περιμένει";
    const link=document.createElement("a");link.className="btn primary";link.href=url.href;link.textContent=document.documentElement.lang==="en"?"Continue the custom session":"Συνέχισε την προσαρμοσμένη συνεδρία";
    card.append(title,link);main.appendChild(card);
  }catch(e){}
})();