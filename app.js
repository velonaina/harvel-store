// ===== CONFIG =====
var API_URL = "https://script.google.com/macros/s/AKfycbyr8QMDn_rG4FZE3Lu6tKTd-ozVRQLrlaZZxYmfR1q8zby8VY7BuAgIo2iM29GFWA4TkQ/exec";
var SECRET_TOKEN = "HRV-2026-xK9mP3qL7nZ";
var WA_NUMBER = "261346158199";

var COLOR_MAP = {
  'vert':'#3dbd00','noir':'#222','rouge':'#e02020','bleu':'#1565c0',
  'violet':'#7b1fa2','gris':'#757575','blanc':'#f0f0f0','rose':'#e8748a',
  'marron':'#8b5e3c','or':'#d4a017','argent':'#a8a9ad','camel':'#c08040',
  'bordeaux':'#7a1a2a','marine':'#1a2a5a','beige':'#f5e6c8','orange':'#f97316','jaune':'#eab308',
};
function getColorHex(n){return COLOR_MAP[n.toLowerCase().trim()]||'#888';}

var products=[],cart=[],activeFilter="Tous",currentProduct=null;
var selectedColor=null,selectedSize=null,selectedOption=null,carouselIndex=0;
var searchQuery='',chronoInterval=null;
function fmt(n){return Number(n).toLocaleString('fr-MG')+' Ar';}

// ===== NOTIFICATIONS =====
var NOTIF_EMOJI={'vert':'🏷️','rouge':'⚠️','orange':'🔥','noir':'🖤','violet':'🎁','bleu':'🚚','rose':'💝','or':'⭐'};

function renderNotifications(notifications){
  if(!notifications||!notifications.length) return;
  var defilants=notifications.filter(function(n){return n.type==='defilant';});
  var bandeau=notifications.find(function(n){return n.type==='bandeau';});
  if(defilants.length>0){
    var items=[].concat(defilants,defilants).map(function(n){
      var emoji=NOTIF_EMOJI[n.couleur]||'📢';
      return '<span class="'+n.couleur+'">'+emoji+' '+n.message+'</span>';
    }).join('');
    document.getElementById('notif-marquee').innerHTML=items;
    document.getElementById('notif-defilant').classList.add('show');
  }
  if(bandeau){
    var el=document.getElementById('notif-bandeau');
    var emoji=NOTIF_EMOJI[bandeau.couleur]||'📢';
    document.getElementById('notif-bandeau-text').innerHTML=
      emoji+' '+bandeau.message+(bandeau.date_fin?' — <span id="chrono"></span>':'');
    el.className='notif-bandeau show '+bandeau.couleur;
    if(bandeau.date_fin){
      if(chronoInterval) clearInterval(chronoInterval);
      var target=new Date(bandeau.date_fin);
      function updateChrono(){
        var diff=target-new Date();
        if(diff<=0){
          var c=document.getElementById('chrono');
          if(c) c.textContent='Offre expirée';
          clearInterval(chronoInterval);
          return;
        }
        var j=Math.floor(diff/86400000);
        var h=Math.floor((diff%86400000)/3600000);
        var m=Math.floor((diff%3600000)/60000);
        var s=Math.floor((diff%60000)/1000);
        var c=document.getElementById('chrono');
        if(c) c.textContent=j>0
          ? j+'j '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')
          : String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
      }
      updateChrono();
      chronoInterval=setInterval(updateChrono,1000);
    }
  }
}

function closeNotifBandeau(){
  document.getElementById('notif-bandeau').classList.remove('show');
  if(chronoInterval) clearInterval(chronoInterval);
}

// ===== COMPTEUR DE VUES =====
var viewers={};
function getViewers(id){
  if(!viewers[id]){
    viewers[id]=Math.floor(Math.random()*8)+2;
    setInterval(function(){
      var delta=Math.random()<0.5?1:-1;
      viewers[id]=Math.max(1,Math.min(15,viewers[id]+delta));
      document.querySelectorAll('.viewer-count-'+id).forEach(function(el){
        el.textContent=viewers[id]+' personne'+(viewers[id]>1?'s':'')+' regardent ce produit';
      });
    },Math.floor(Math.random()*8000)+5000);
  }
  return viewers[id];
}

// ===== ANIMATION PANIER =====
function animateToCart(emoji){
  var addBtn=document.getElementById('add-cart-btn');
  var cartBtn=document.getElementById('nav-cart');
  if(!addBtn||!cartBtn) return;
  var startRect=addBtn.getBoundingClientRect();
  var fly=document.createElement('div');
  fly.className='fly-item';
  fly.textContent=emoji||'🛒';
  fly.style.left=(startRect.left+startRect.width/2-20)+'px';
  fly.style.top=(startRect.top+startRect.height/2-20)+'px';
  document.body.appendChild(fly);
  setTimeout(function(){
    fly.remove();
    cartBtn.classList.add('bounce');
    setTimeout(function(){cartBtn.classList.remove('bounce');},400);
  },650);
}

// ===== WHATSAPP =====
function getWhatsAppUrl(p){
  var variant=[selectedColor,selectedSize,selectedOption?selectedOption.name:null].filter(Boolean).join(', ');
  var price=selectedOption&&selectedOption.price>0?selectedOption.price:p.price;
  var msg='Bonjour Harvel Store ! 👋\n\nJe suis intéressé(e) par :\n';
  msg+='🛍️ *'+p.name+'*\n';
  if(variant) msg+='📌 Variante : '+variant+'\n';
  msg+='💰 Prix : '+fmt(price)+'\n\nPouvez-vous me confirmer la disponibilité ? Merci !';
  return 'https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(msg);
}

// ===== SUIVI COMMANDE =====
// Messages WhatsApp contextuels selon le statut
function getWaSuiviUrl(num, statut) {
  var messages = {
    'En attente': 'Bonjour Harvel Store ! 👋 Je voudrais confirmer ma commande *' + num + '*. Merci !',
    'Confirmé'  : 'Bonjour Harvel Store ! 👋 Ma commande *' + num + '* est confirmée, avez-vous une estimation de livraison ? Merci !',
    'Expédié'   : 'Bonjour Harvel Store ! 👋 Ma commande *' + num + '* est en cours de livraison, pouvez-vous me donner plus d\'informations ? Merci !',
    'Livré'     : 'Bonjour Harvel Store ! 👋 J\'ai bien reçu ma commande *' + num + '*. Merci pour votre service ! 🎉',
    'Annulé'    : 'Bonjour Harvel Store ! 👋 Ma commande *' + num + '* a été annulée, j\'aimerais en savoir plus. Merci !',
  };
  var msg = messages[statut] || 'Bonjour Harvel Store ! 👋 J\'ai une question sur ma commande *' + num + '*. Merci !';
  return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg);
}
var STATUT_STEPS=['En attente','Confirmé','Expédié','Livré'];
var STATUT_ICONS={'En attente':'⏳','Confirmé':'✅','Expédié':'🚚','Livré':'🎉','Annulé':'❌'};
var STATUT_CLASS={'En attente':'statut-attente','Confirmé':'statut-confirme','Expédié':'statut-expedie','Livré':'statut-livre','Annulé':'statut-annule'};

async function suivreCommande(){
  var num=document.getElementById('suivi-input').value.trim().toUpperCase();
  var phone=document.getElementById('suivi-phone').value.trim().replace(/\s/g,'');
  var result=document.getElementById('suivi-result');
  if(!num){showToast('⚠️ Entrez votre numéro de commande','warning');return;}
  if(!phone){showToast('⚠️ Entrez votre numéro de téléphone','warning');return;}
  result.innerHTML='<div class="loading"><div class="spinner"></div><p>Recherche en cours...</p></div>';
  result.classList.add('show');
  try{
    var url=API_URL+'?token='+SECRET_TOKEN+'&action=suivi&commande='+encodeURIComponent(num)+'&phone='+encodeURIComponent(phone);
    var res=await fetch(url,{redirect:'follow'});
    var data=JSON.parse(await res.text());
    if(!data.success||!data.commande){
      result.innerHTML='<div class="suivi-error">❌ Commande introuvable ou téléphone incorrect.<br/>Vérifiez vos informations et réessayez.<br/><br/>💡 Numéro oublié ? Contactez-nous via WhatsApp ou Facebook ci-dessus.</div>';
      return;
    }
    var c=data.commande;
    var statut=c.statut||'En attente';
    var stepIndex=STATUT_STEPS.indexOf(statut);
    var stepsHtml=STATUT_STEPS.map(function(s,i){
      var isDone=i<stepIndex,isActive=i===stepIndex;
      var cls=isDone?'done':isActive?'active':'pending';
      return '<div class="suivi-step"><div class="step-dot '+(isDone?'done':isActive?'active':'')+'">'+(isDone?'✓':(STATUT_ICONS[s]||'○'))+'</div><div class="step-info"><div class="step-label '+cls+'">'+s+'</div></div></div>';
    }).join('');
    var raisonHtml=c.raison&&statut==='Annulé'?'<div class="suivi-raison">❌ Motif : '+c.raison+'</div>':'';
    var historique=c.historique||'';
    var historiqueParsed=historique?historique.split(' | ').map(function(h){
      var parts=h.split(' — ');
      var st=parts[0]||'';
      var dt=parts.slice(1).join(' — ')||'';
      return '<div class="hist-item"><span class="hist-statut">'+st+'</span><span class="hist-date">'+dt+'</span></div>';
    }).join(''):'';
    var historiqueHtml=historiqueParsed?'<div class="suivi-historique"><div class="hist-title">📋 Historique</div>'+historiqueParsed+'</div>':'';
    var waUrl=getWaSuiviUrl(c.num,statut);
    var waSuiviHtml='<a class="suivi-wa-btn" href="'+waUrl+'" target="_blank">'+
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'+
      ' Contacter via WhatsApp</a>';
    result.innerHTML='<div class="suivi-card"><div class="suivi-num">Commande '+c.num+' — '+c.date+'</div><div class="suivi-statut '+(STATUT_CLASS[statut]||'statut-attente')+'">'+(STATUT_ICONS[statut]||'⏳')+' '+statut+'</div>'+raisonHtml+'<div class="suivi-steps">'+stepsHtml+'</div>'+historiqueHtml+'<div class="suivi-produits">🛍️ '+c.produits+'</div>'+waSuiviHtml+'</div>';
  }catch(err){
    result.innerHTML='<div class="suivi-error">❌ Erreur lors de la recherche. Réessayez.</div>';
  }
}

// ===== LOAD PRODUCTS =====
async function loadProducts(){
  showLoadingState('home-products');
  showLoadingState('shop-products');
  try{
    var url=API_URL+'?token='+SECRET_TOKEN+'&t='+Date.now();
    var res=await fetch(url,{redirect:'follow'});
    var data=JSON.parse(await res.text());
    if(!data.success) throw new Error(data.error);
    products=data.produits;
    renderNotifications(data.notifications);
    renderHome();
    renderShop();
    showToast('✅ '+products.length+' produits chargés');
    return true;
  }catch(err){
    console.error(err);
    showErrorState('home-products');
    showErrorState('shop-products');
    showToast('❌ Impossible de charger le catalogue','error');
  }
}

function showLoadingState(id){var el=document.getElementById(id);if(el)el.innerHTML='<div class="loading"><div class="spinner"></div><p>Chargement...</p></div>';}
function showErrorState(id){var el=document.getElementById(id);if(el)el.innerHTML='<div class="error-box"><p>⚠️ Impossible de charger les produits.</p><button class="retry-btn" onclick="loadProducts()">🔄 Réessayer</button></div>';}

function getCats(){return['Tous'].concat(Array.from(new Set(products.map(function(p){return p.cat;}))));}
function filteredProducts(){return activeFilter==='Tous'?products:products.filter(function(p){return p.cat===activeFilter;});}
function getPhotos(p){return p.emoji&&p.emoji.startsWith('http')?p.emoji.split(',').map(function(u){return u.trim();}).filter(Boolean):[];}
function getColorPhotos(p,ci){var k=['photos_c1','photos_c2','photos_c3','photos_c4','photos_c5'][ci];if(p[k])return p[k].split(',').map(function(u){return u.trim();}).filter(Boolean);return getPhotos(p);}
function getColors(p){return p.couleurs?p.couleurs.split(',').map(function(c){return c.trim();}).filter(Boolean):[];}
function getSizes(p){return p.tailles?p.tailles.split(',').map(function(s){return s.trim();}).filter(Boolean):[];}

function filteredAndSearched(){
  var list=filteredProducts();
  if(searchQuery) list=list.filter(function(p){return p.name.toLowerCase().includes(searchQuery)||p.cat.toLowerCase().includes(searchQuery);});
  var sort=document.getElementById('sort-select');
  if(sort){
    switch(sort.value){
      case 'price-asc': list=list.slice().sort(function(a,b){return a.price-b.price;}); break;
      case 'price-desc': list=list.slice().sort(function(a,b){return b.price-a.price;}); break;
      case 'stock-desc': list=list.slice().sort(function(a,b){return b.stock-a.stock;}); break;
      case 'name-asc': list=list.slice().sort(function(a,b){return a.name.localeCompare(b.name);}); break;
    }
  }
  return list;
}

function onSearch(val){
  searchQuery=val.trim().toLowerCase();
  var cb=document.getElementById('search-clear');
  if(cb) cb.classList.toggle('show',searchQuery.length>0);
  renderShop();
}

function clearSearch(){
  searchQuery='';
  var inp=document.getElementById('search-input');
  if(inp) inp.value='';
  var cb=document.getElementById('search-clear');
  if(cb) cb.classList.remove('show');
  renderShop();
}

function renderCats(id,fn){
  var el=document.getElementById(id);if(!el)return;
  el.innerHTML=getCats().map(function(c){return '<button class="cat'+(activeFilter===c?' active':'')+'" onclick="'+fn+'(\''+c+'\')">'+c+'</button>';}).join('');
}

function renderProductGrid(id,list){
  var el=document.getElementById(id);if(!el)return;
  if(!list.length){el.innerHTML='<div class="loading"><p>Aucun produit trouvé.</p></div>';return;}
  el.innerHTML='<div class="products">'+list.map(function(p){
    var ph=getPhotos(p);
    var v=getViewers(p.id);
    var badge='';
if(p.badge){
  badge='<div class="prod-badge-wrap">'+p.badge.split(',').map(function(b){
    b=b.trim();
    return '<div class="prod-badge badge-'+b.toLowerCase()+'">'+b+'</div>';
  }).join('')+'</div>';
}
    var imgHtml=ph.length>0?'<img src="'+ph[0]+'" alt="'+p.name+'" onerror="this.parentElement.innerHTML=\'📦\'"/>':'<span>'+(p.emoji&&!p.emoji.startsWith('http')?p.emoji:'📦')+'</span>';
    var stockHtml=p.stock===0?'❌ Rupture':p.stock<=3?'⚠️ Plus que '+p.stock:'✅ En stock';
    var btnHtml=p.stock===0?'<button class="view-btn" disabled>Indisponible</button>':'<button class="view-btn" onclick="event.stopPropagation();openProduct('+p.id+')">Voir le produit →</button>';
    return '<div class="product-card" onclick="openProduct('+p.id+')">'+badge+'<div class="prod-img">'+imgHtml+'</div><div class="prod-info"><div class="prod-name">'+p.name+'</div><div class="prod-price">'+(p.prix_barre?'<span class="prix-barre">'+fmt(p.prix_barre)+'</span><span class="prix-promo">'+fmt(p.price)+'</span><span class="promo-badge">-'+Math.round((1-p.price/p.prix_barre)*100)+'%</span>':fmt(p.price))+'</div><div class="prod-viewers">👁️ <span class="viewer-count-'+p.id+'">'+v+' personne'+(v>1?'s':'')+' regardent ce produit</span></div><div class="prod-stock'+(p.stock<=3?' stock-low':'')+'">'+stockHtml+'</div>'+btnHtml+'</div></div>';
  }).join('')+'</div>';
}

function renderHome(){renderCats('home-cats','filterHome');renderProductGrid('home-products',filteredProducts().slice(0,4));}
function renderShop(){renderCats('shop-cats','filterShop');renderProductGrid('shop-products',filteredAndSearched());}
function filterHome(c){activeFilter=c;renderHome();}
function filterShop(c){activeFilter=c;renderShop();}

function openProduct(id){
  currentProduct=products.find(function(p){return p.id==id;});
  if(!currentProduct) return;
  selectedColor=null;selectedSize=null;selectedOption=null;
  var p=currentProduct,colors=getColors(p),sizes=getSizes(p),mainPhotos=getPhotos(p);
  var v=getViewers(p.id);
  carouselIndex=0;

  var optHtml='';
  if(p.options){
    var opts=p.options.split(',').map(function(o){return o.trim();});
    optHtml='<div class="option-group"><div class="option-label">🎁 Options spéciales : <span id="selected-option-label">— choisissez —</span></div><div class="special-options">'+
    opts.map(function(opt){
      var parts=opt.split(':');
      var nom=parts[0].trim();
      var px=parts[1]?Number(parts[1].trim()):0;
      return '<button class="special-btn" onclick="selectOption(\''+nom+'\','+px+',this)">'+(px?nom+' — '+fmt(px):nom)+'</button>';
    }).join('')+
    '</div></div>';
  }

  var colHtml='';
  if(colors.length){
    colHtml='<div class="option-group"><div class="option-label">🎨 Couleur : <span id="selected-color-label">— choisissez</span></div><div class="color-options">'+colors.map(function(c,i){return '<button class="color-btn-label" onclick="selectColor(\''+c+'\','+i+',this)"><span class="color-dot" style="background:'+getColorHex(c)+';"></span>'+c+'</button>';}).join('')+'</div></div>';
  }

  var szHtml='';
  if(sizes.length){
    var isOne=sizes.length===1&&sizes[0].toLowerCase().includes('one');
    szHtml='<div class="option-group"><div class="option-label">📏 Taille : <span id="selected-size-label">'+(isOne?'One Size':'— choisissez')+'</span></div><div class="size-options">'+sizes.map(function(s){return '<button class="size-btn'+(isOne?' one-size':'')+'" onclick="selectSize(\''+s+'\',this)">'+s+'</button>';}).join('')+'</div>'+(p.guide_tailles?'<button class="size-guide-toggle" onclick="toggleSizeGuide()">📏 Guide des tailles</button><div class="size-guide" id="size-guide"><table>'+p.guide_tailles.split(',').map(function(g){var parts=g.split(':');return '<tr><td>'+(parts[0]||'')+'</td><td>'+(parts[1]||'')+'</td></tr>';}).join('')+'</table></div>':'')+'</div>';
    if(isOne) selectedSize=sizes[0];
  }

  var carouselHtml=mainPhotos.length>0?mainPhotos.map(function(u,i){return '<img src="'+u+'" class="'+(i===0?'active':'')+'" onerror="this.style.display=\'none\'"/>';}).join(''):'<div class="no-img">'+(p.emoji&&!p.emoji.startsWith('http')?p.emoji:'📦')+'</div>';
  var arrowHtml=mainPhotos.length>1?'<button class="carousel-arrow prev" onclick="carouselPrev()">‹</button><button class="carousel-arrow next" onclick="carouselNext()">›</button>':'';
  var dotsHtml=mainPhotos.map(function(_,i){return '<div class="carousel-dot '+(i===0?'active':'')+'" onclick="goToSlide('+i+')"></div>';}).join('');
  var thumbsHtml=mainPhotos.length>1?'<div class="carousel-thumbs" id="carousel-thumbs">'+mainPhotos.map(function(u,i){return '<img src="'+u+'" class="carousel-thumb '+(i===0?'active':'')+'" onclick="goToSlide('+i+')" onerror="this.style.display=\'none\'"/>';}).join('')+'</div>':'';
  var waUrl=getWhatsAppUrl(p);

  document.getElementById('product-detail').innerHTML=
    '<button class="back-to-shop" onclick="showPage(\'shop\')" style="margin-bottom:16px;width:auto;padding:8px 16px;">← Retour</button>'+
    '<div class="product-page">'+
      '<div><div class="carousel-wrap">'+
        '<div class="carousel-main" id="carousel-main">'+carouselHtml+'</div>'+
        arrowHtml+
        '<div class="carousel-dots" id="carousel-dots">'+dotsHtml+'</div>'+
        thumbsHtml+
      '</div></div>'+
      '<div class="product-details">'+
(p.badge?'<div class="prod-badge-wrap" style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px;">'+p.badge.split(',').map(function(b){b=b.trim();return '<div class="prod-badge badge-'+b.toLowerCase()+'">'+b+'</div>';}).join('')+'</div>':'')+
        '<div class="pd-category">'+p.cat+(p.sous_categorie?' — '+p.sous_categorie:'')+'</div>'+
        '<div class="pd-name">'+p.name+'</div>'+
        '<div class="pd-price" id="pd-price">'+(p.prix_barre?'<span class="prix-barre">'+fmt(p.prix_barre)+'</span><span class="prix-promo">'+fmt(p.price)+'</span><span class="promo-badge">-'+Math.round((1-p.price/p.prix_barre)*100)+'%</span>':fmt(p.price))+'</div>'+
        (p.matiere?'<div class="pd-matiere">🧵 <strong>Matière :</strong> '+p.matiere+'</div>':'')+
        (p.description?'<div class="pd-desc">'+p.description+'</div>':'')+
        colHtml+szHtml+optHtml+
        '<div class="selection-summary" id="selection-summary" style="display:none;">✅ <strong>Votre sélection :</strong> <span id="summary-text"></span></div>'+
        '<div class="pd-viewers">👁️ <span class="viewer-count-'+p.id+'">'+v+' personne'+(v>1?'s':'')+' regardent ce produit</span></div>'+
        '<div class="prod-stock'+(p.stock<=3?' stock-low':'')+'" style="margin-bottom:14px;">'+(p.stock===0?'❌ Rupture de stock':p.stock<=3?'⚠️ Plus que '+p.stock+' en stock':'✅ En stock ('+p.stock+')')+'</div>'+
        '<button class="add-to-cart-btn" id="add-cart-btn" onclick="addToCartFromProduct()"'+(p.stock===0?' disabled':'')+'>🛒 Ajouter au panier</button>'+
        '<a id="wa-btn" class="whatsapp-btn" href="'+waUrl+'" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Commander via WhatsApp</a>'+
        '<button class="back-to-shop" onclick="showPage(\'shop\')">← Continuer mes achats</button>'+
      '</div>'+
    '</div>';
  window.location.hash = 'product-'+id;
  showPage('product');
  initCarouselSwipe();
}

// ===== CAROUSEL =====
function goToSlide(index){
  var main=document.getElementById('carousel-main');
  if(!main) return;
  var imgs=main.querySelectorAll('img');
  if(!imgs.length) return;
  carouselIndex=(index+imgs.length)%imgs.length;
  imgs.forEach(function(img,i){img.className=i===carouselIndex?'active':'';});
  var dots=document.getElementById('carousel-dots');
  if(dots) dots.querySelectorAll('.carousel-dot').forEach(function(d,i){d.className='carousel-dot'+(i===carouselIndex?' active':'');});
  var thumbs=document.getElementById('carousel-thumbs');
  if(thumbs) thumbs.querySelectorAll('.carousel-thumb').forEach(function(t,i){t.className='carousel-thumb'+(i===carouselIndex?' active':'');});
}

function carouselNext(){ goToSlide(carouselIndex+1); }
function carouselPrev(){ goToSlide(carouselIndex-1); }

var swipeStartX = 0;
var swipeStartY = 0;

function initCarouselSwipe(){
  var carouselMain = document.getElementById('carousel-main');
  if (!carouselMain || carouselMain._swipeInit) return;
  carouselMain._swipeInit = true;

  carouselMain.addEventListener('touchstart', function(e) {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  carouselMain.addEventListener('touchend', function(e) {
    var diffX = swipeStartX - e.changedTouches[0].clientX;
    var diffY = swipeStartY - e.changedTouches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) { carouselNext(); }
      else { carouselPrev(); }
    }
  }, { passive: true });
}

function updateCarouselForColor(ci){
  if(!currentProduct) return;
  var photos=getColorPhotos(currentProduct,ci);
  var main=document.getElementById('carousel-main');
  var dots=document.getElementById('carousel-dots');
  var thumbs=document.getElementById('carousel-thumbs');
  if(!main||!photos.length) return;
  carouselIndex=0;
  main.innerHTML=photos.map(function(u,i){return '<img src="'+u+'" class="'+(i===0?'active':'')+'" onerror="this.style.display=\'none\'"/>';}).join('');
  main._swipeInit=false;
  if(dots) dots.innerHTML=photos.map(function(_,i){return '<div class="carousel-dot '+(i===0?'active':'')+'" onclick="goToSlide('+i+')"></div>';}).join('');
  if(thumbs) thumbs.innerHTML=photos.map(function(u,i){return '<img src="'+u+'" class="carousel-thumb '+(i===0?'active':'')+'" onclick="goToSlide('+i+')" onerror="this.style.display=\'none\'"/>';}).join('');
  initCarouselSwipe();
}

function selectColor(c,i,btn){selectedColor=c;document.querySelectorAll('.color-btn-label').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-color-label');if(l)l.textContent=c;updateCarouselForColor(i);updateSummary();}
function selectSize(s,btn){selectedSize=s;document.querySelectorAll('.size-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-size-label');if(l)l.textContent=s;updateSummary();}
function selectOption(opt,prix,btn){selectedOption={name:opt,price:prix};document.querySelectorAll('.special-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-option-label');if(l)l.textContent=opt;var pe=document.getElementById('pd-price');if(pe&&prix>0)pe.textContent=fmt(prix);updateSummary();}
function toggleSizeGuide(){var g=document.getElementById('size-guide');if(g)g.classList.toggle('show');}

function updateSummary(){
  var s=document.getElementById('selection-summary'),t=document.getElementById('summary-text');if(!s||!t) return;
  var parts=[];if(selectedColor)parts.push('Couleur : '+selectedColor);if(selectedSize)parts.push('Taille : '+selectedSize);if(selectedOption)parts.push('Option : '+selectedOption.name);
  if(parts.length){t.textContent=parts.join(' — ');s.style.display='block';}else s.style.display='none';
  var waBtn=document.getElementById('wa-btn');
  if(waBtn&&currentProduct) waBtn.href=getWhatsAppUrl(currentProduct);
}

function addToCartFromProduct(){
  var p=currentProduct;if(!p) return;
  var colors=getColors(p),sizes=getSizes(p),isOne=sizes.length===1&&sizes[0].toLowerCase().includes('one');
  if(colors.length>0&&!selectedColor){showToast('⚠️ Veuillez choisir une couleur','warning');return;}
  if(sizes.length>0&&!isOne&&!selectedSize){showToast('⚠️ Veuillez choisir une taille','warning');return;}
  var price=selectedOption&&selectedOption.price>0?selectedOption.price:p.price;
  var variant=[selectedColor,selectedSize,selectedOption?selectedOption.name:null].filter(Boolean).join(' — ');
  var cartKey=p.id+'_'+variant;
  var photos=getPhotos(p);
  var ex=cart.find(function(i){return i.cartKey===cartKey;});
  var emojiForAnim=p.emoji&&!p.emoji.startsWith('http')?p.emoji:'🛒';
  if(ex){
    if(ex.qty<p.stock){ex.qty++;showToast('✅ '+p.name+' mis à jour');animateToCart(emojiForAnim);}
    else{showToast('⚠️ Stock maximum atteint !','warning');return;}
  }else{
    cart.push(Object.assign({},p,{price:price,variant:variant,cartKey:cartKey,qty:1,thumb:photos[0]||null}));
    showToast('✅ '+p.name+' ajouté au panier');
    animateToCart(emojiForAnim);
  }
  updateCartCount();
}

function updateCartCount(){
  var count=cart.reduce(function(s,i){return s+i.qty;},0);
  document.getElementById('cart-count').textContent=count;
  var mc=document.getElementById('mobile-cart-count');
  if(mc) mc.textContent=count;
}

function renderCart(){
  var el=document.getElementById('cart-content');
  if(!cart.length){
    el.innerHTML='<div class="cart-empty"><div class="icon">🛒</div><p>Votre panier est vide.</p><br><button class="hero-btn" style="background:var(--primary);color:#fff;" onclick="showPage(\'shop\')">Voir la boutique</button></div>';
    return;
  }
  var sub=cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  var itemsHtml=cart.map(function(i){
    var imgHtml=i.thumb?'<img src="'+i.thumb+'" onerror="this.parentElement.innerHTML=\'📦\'"/>':(i.emoji&&!i.emoji.startsWith('http')?'<span>'+i.emoji+'</span>':'<span>📦</span>');
    return '<div class="cart-item"><div class="ci-icon">'+imgHtml+'</div><div class="ci-info"><div class="ci-name">'+i.name+'</div>'+(i.variant?'<div class="ci-variant">📌 '+i.variant+'</div>':'')+'<div class="ci-price">'+fmt(i.price)+'</div><div class="ci-qty"><button class="qty-btn" onclick="changeQty(\''+i.cartKey+'\',-1)">−</button><span>'+i.qty+'</span><button class="qty-btn" onclick="changeQty(\''+i.cartKey+'\',1)">+</button></div></div><button class="remove-btn" onclick="removeFromCart(\''+i.cartKey+'\')">🗑️</button></div>';
  }).join('');
  el.innerHTML='<div class="section-title">Mon Panier</div><div class="cart-items">'+itemsHtml+'</div><div class="cart-summary"><div class="summary-row"><span>Articles ('+cart.reduce(function(s,i){return s+i.qty;},0)+')</span><span>'+fmt(sub)+'</span></div><div class="summary-row"><span>Livraison</span><span>Selon votre zone</span></div><div class="summary-row summary-total"><span>Total produits</span><span>'+fmt(sub)+'</span></div><button class="checkout-btn" onclick="goToOrder()">🛍️ Passer la commande</button></div>';
}

function changeQty(key,d){
  var item=cart.find(function(x){return x.cartKey===key;});
  if(!item) return;
  var prod=products.find(function(x){return x.id==item.id;});
  item.qty+=d;
  if(item.qty<=0) cart=cart.filter(function(x){return x.cartKey!==key;});
  else if(prod&&item.qty>prod.stock){item.qty=prod.stock;showToast('⚠️ Stock maximum atteint !','warning');}
  updateCartCount();renderCart();
}
function removeFromCart(key){cart=cart.filter(function(x){return x.cartKey!==key;});updateCartCount();renderCart();}

// ===== MINI PANIER =====
function renderMiniCart(){
  var itemsEl=document.getElementById('mini-cart-items');
  var totalEl=document.getElementById('mini-cart-total');
  var countEl=document.getElementById('mini-cart-count');
  if(!itemsEl) return;
  var sb=document.getElementById('submit-btn');
  if(!cart.length){
    itemsEl.innerHTML='<div class="mini-cart-empty">Votre panier est vide.</div>';
    if(totalEl) totalEl.textContent=fmt(0);
    if(countEl) countEl.textContent='';
    if(sb) sb.disabled=true;
    return;
  }
  var sub=cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  if(countEl) countEl.textContent=cart.reduce(function(s,i){return s+i.qty;},0)+' article(s)';
  if(totalEl) totalEl.textContent=fmt(sub);
  if(sb) sb.disabled=false;
  itemsEl.innerHTML=cart.map(function(i){
    var thumb=i.thumb?'<img src="'+i.thumb+'" onerror="this.parentElement.innerHTML=\'📦\'"/>':(i.emoji&&!i.emoji.startsWith('http')?'<span>'+i.emoji+'</span>':'<span>📦</span>');
    var variant=i.variant?'<div class="mini-ci-variant">📌 '+i.variant+'</div>':'';
    return '<div class="mini-cart-item"><div class="mini-ci-img">'+thumb+'</div><div class="mini-ci-info"><div class="mini-ci-name">'+i.name+'</div>'+variant+'<div class="mini-ci-price">'+fmt(i.price)+'</div></div><div class="mini-ci-qty"><button class="mini-qty-btn" onclick="miniChangeQty(\''+i.cartKey+'\',-1)">−</button><span style="font-weight:600;min-width:16px;text-align:center;">'+i.qty+'</span><button class="mini-qty-btn" onclick="miniChangeQty(\''+i.cartKey+'\',1)">+</button></div><button class="mini-remove-btn" onclick="miniRemove(\''+i.cartKey+'\')">🗑️</button></div>';
  }).join('');
}

function miniChangeQty(key,d){
  var item=cart.find(function(x){return x.cartKey===key;});
  if(!item) return;
  var prod=products.find(function(x){return x.id==item.id;});
  item.qty+=d;
  if(item.qty<=0) cart=cart.filter(function(x){return x.cartKey!==key;});
  else if(prod&&item.qty>prod.stock){item.qty=prod.stock;showToast('⚠️ Stock maximum atteint !','warning');}
  updateCartCount();
  renderMiniCart();
}

function miniRemove(key){
  cart=cart.filter(function(x){return x.cartKey!==key;});
  updateCartCount();
  renderMiniCart();
  if(!cart.length) showToast('🛒 Panier vide — ajoutez des articles','warning');
}

function goToOrder(){showPage('order');renderMiniCart();}

function copyOrderNum(){
  var num=document.getElementById('success-order-num').textContent.replace('📋 ','').trim();
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(num).then(function(){
      var btn=document.getElementById('copy-order-btn');
      btn.textContent='✅ Numéro copié !';
      btn.style.background='#edfae3';
      setTimeout(function(){btn.textContent='📋 Copier mon numéro de commande';btn.style.background='';},2000);
    }).catch(function(){
      fallbackCopy(num);
    });
  } else {
    fallbackCopy(num);
  }
}

function fallbackCopy(text){
  var ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed';ta.style.opacity='0';
  document.body.appendChild(ta);
  ta.select();
  try{
    document.execCommand('copy');
    var btn=document.getElementById('copy-order-btn');
    if(btn){btn.textContent='✅ Numéro copié !';btn.style.background='#edfae3';setTimeout(function(){btn.textContent='📋 Copier mon numéro de commande';btn.style.background='';},2000);}
  }catch(e){showToast('⚠️ Copie impossible, notez le manuellement','warning');}
  document.body.removeChild(ta);
}

async function submitOrder(){
  var name=document.getElementById('f-name').value.trim();
  var phone=document.getElementById('f-phone').value.trim();
  var address=document.getElementById('f-address').value.trim();
  var note=document.getElementById('f-note').value.trim();
  if(!name||!phone||!address){showToast('⚠️ Veuillez remplir tous les champs obligatoires.','warning');return;}
  if(!cart.length){showToast('⚠️ Votre panier est vide.','warning');return;}
  var btn=document.getElementById('submit-btn');btn.disabled=true;btn.textContent='⏳ Envoi en cours...';
  var payload={
    customer:{name:name,phone:phone,address:address,note:note},
    items:cart.map(function(i){return {id:i.id,name:i.name+(i.variant?' ('+i.variant+')':''),price:i.price,qty:i.qty};}),
    total:cart.reduce(function(s,i){return s+i.price*i.qty;},0),
    token:SECRET_TOKEN
  };
  try{
    var res=await fetch(API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
    var data=await res.json();
    if(!data.success) throw new Error(data.error);
    var orderNum=data.commande;
    document.getElementById('success-order-num').textContent='📋 '+orderNum;
    var waMsg='Bonjour Harvel Store ! 👋\n\nJe viens de passer une commande et je souhaite garder une trace de mon numéro :\n📋 *'+orderNum+'*\n\nMerci !';
    document.getElementById('wa-order-btn').href='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(waMsg);
    cart.forEach(function(item){var prod=products.find(function(p){return p.id==item.id;});if(prod)prod.stock=Math.max(0,prod.stock-item.qty);});
    ['f-name','f-phone','f-address','f-note'].forEach(function(id){document.getElementById(id).value='';});
    cart=[];updateCartCount();showPage('success');
  }catch(err){showToast('❌ Erreur lors de l\'envoi. Réessayez.','error');}
  finally{btn.disabled=false;btn.textContent='✅ Confirmer la commande';}
}

function resetAndGoHome(){activeFilter='Tous';searchQuery='';showPage('home');}

function toggleMenu(){
  document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}

function showPage(p){
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.nav-links button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+p).classList.add('active');
  var nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('active');
  if(p==='home') renderHome();
  if(p==='shop') renderShop();
  if(p==='cart') renderCart();
  if(p !== 'product') window.location.hash = p==='home' ? '' : p;
  window.scrollTo(0,0);
}

function showToast(msg,type){
  var t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(type||'');
  setTimeout(function(){t.classList.remove('show');},2800);
}

// ===== INIT =====
function initFromHash(){
  var hash = window.location.hash.replace('#','');
  if(!hash || hash==='home'){
    showPage('home');
  } else if(hash==='shop'){
    showPage('shop');
  } else if(hash==='about'){
    showPage('about');
  } else if(hash==='suivi'){
    showPage('suivi');
  } else if(hash==='cart'){
    showPage('cart');
  } else if(hash.startsWith('product-')){
    var id=hash.replace('product-','');
    var p=products.find(function(p){return p.id==id;});
    if(p) openProduct(id);
    else showPage('home');
  } else {
    showPage('home');
  }
}

// ===== BOUTON RETOUR EN HAUT =====
window.addEventListener('scroll', function(){
  var btn = document.getElementById('back-to-top');
  if(btn) btn.classList.toggle('show', window.scrollY > 300);
});

// ===== COOKIES =====
function initCookieBanner(){
  if(!localStorage.getItem('cookie_consent')){
    setTimeout(function(){
      var banner=document.getElementById('cookie-banner');
      if(banner) banner.classList.add('show');
    },1000);
  }
}

function acceptCookies(){
  localStorage.setItem('cookie_consent','accepted');
  document.getElementById('cookie-banner').classList.remove('show');
}

function refuseCookies(){
  localStorage.setItem('cookie_consent','refused');
  document.getElementById('cookie-banner').classList.remove('show');
}

initCookieBanner();

loadProducts().then(function(){
  initFromHash();
});
