function copyText(text) {
  if (!navigator.clipboard) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    return;
  }
  navigator.clipboard.writeText(text).catch(()=>{});
}

// Optional: add a click handler to copy raw URL when a 'Share' link exists
window.addEventListener('load', ()=>{
  document.querySelectorAll('a').forEach(a=>{
    if (a.textContent.trim()==='Share'){
      a.addEventListener('click', (ev)=>{
        // prefer copy to clipboard
        ev.preventDefault();
        const href = a.href;
        copyText(href);
        a.textContent = 'Copied!';
        setTimeout(()=> a.textContent='Share', 1500);
      });
    }
  });
});