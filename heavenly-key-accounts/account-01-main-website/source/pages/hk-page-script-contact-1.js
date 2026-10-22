
document.addEventListener('DOMContentLoaded',function(){
  var value=new URLSearchParams(location.search).get('subject');
  var select=document.getElementById('c-subject');
  if(select&&['suggestion','feedback','testimony','prayer','inquiry','partnership'].includes(value||''))select.value=value;
});
