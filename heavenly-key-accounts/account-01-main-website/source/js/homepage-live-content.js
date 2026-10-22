(function(){
  "use strict";
  var latestPastorPhoto='assets/ministry/Evangelist%20Emmanuel%20picture1.jpeg';
  var pastorPhoto=document.querySelector('.president .photo img');
  if(pastorPhoto){
    pastorPhoto.src=latestPastorPhoto;
    pastorPhoto.alt='Evangelist Emmanuel Ogheneochuko Adiohwo';
  }
  function apply(content){
    var slider=document.querySelector('.slider');
    if(!slider||!content)return;
    var slides=Array.prototype.slice.call(slider.querySelectorAll('.slide'));
    var thumbs=Array.prototype.slice.call(document.querySelectorAll('.thumbs img'));
    slides.forEach(function(slide,i){
      var img=slide.querySelector('img');
      var key='hero_slide_'+(i+1)+'_image';
      var alt='hero_slide_'+(i+1)+'_alt';
      if(img&&content[key]) img.src=content[key];
      if(img&&content[alt]) img.alt=content[alt];
      if(thumbs[i]&&content[key]) thumbs[i].src=content[key];
      if(thumbs[i]&&content[alt]) thumbs[i].alt=content[alt];
    });
  }
  fetch('/api/site-content/homepage',{credentials:'same-origin',headers:{Accept:'application/json'}})
    .then(function(r){return r.ok?r.json():Promise.reject();})
    .then(function(p){apply(p.content||{});})
    .catch(function(){/* keep built-in images as safe fallback */});
})();
