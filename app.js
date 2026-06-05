// ===== CONFIG =====
// ===== MAINTENANCE =====
// Passe à true pour activer la maintenance, false pour remettre en ligne
var MAINTENANCE = false;
var MAINTENANCE_MSG = "Nous effectuons des améliorations pour mieux vous servir.";
var GROS_COMMANDE_LIMITE = 10; // Au-delà → redirection WhatsApp
var MAINTENANCE_DUREE = "30 minutes"; // Laisse vide "" pour ne pas afficher la durée
var API_URL = "https://harvel-proxy.herryharivelo.workers.dev";
// Token supprimé — géré côté serveur par le proxy Cloudflare
var WA_NUMBER = "261346158199";
var COLOR_MAP = {
  'vert':'#3dbd00','noir':'#222','rouge':'#e02020','bleu':'#1565c0',
  'violet':'#7b1fa2','gris':'#757575','blanc':'#f0f0f0','rose':'#e8748a',
  'marron':'#8b5e3c','or':'#d4a017','argent':'#a8a9ad','camel':'#c08040',
  'bordeaux':'#7a1a2a','marine':'#1a2a5a','beige':'#f5e6c8','orange':'#f97316','jaune':'#eab308',
};
function getColorHex(n){return COLOR_MAP[n.toLowerCase().trim()]||'#888';}
var products=[],cart=[],activeFilter="Tous",currentProduct=null;
var selectedColor=null,selectedSize=null,selectedOption=null,selectedQty=1,selectedCodePromo=null,carouselIndex=0;
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
    var url=API_URL+'?action=suivi&commande='+encodeURIComponent(num)+'&phone='+encodeURIComponent(phone);
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
    var dateLivraisonHtml=statut!=='Annulé'&&statut!=='Livré'
      ?'<div class="suivi-livraison">🚚 Livraison estimée : <strong>'+(c.date_livraison||'En cours de planification...')+'</strong></div>'
      :'';
    var historique=c.historique||'';
    var historiqueParsed=historique?historique.split(' | ').map(function(h){
      var parts=h.split(' — ');
      var st=parts[0]||'';
      var dt=parts.slice(1).join(' — ')||'';
      return '<div class="hist-item"><span class="hist-statut">'+st+'</span><span class="hist-date">'+dt+'</span></div>';
    }).join(''):'';
    var historiqueHtml=historiqueParsed?'<div class="suivi-historique"><div class="hist-title">📋 Historique</div>'+historiqueParsed+'</div>':'';
    var waUrl=getWaSuiviUrl(c.num,statut);
    var waHints={
      'En attente' : '💡 Appuyez sur le bouton pour confirmer votre commande avec notre équipe.',
      'Confirmé'   : '💡 Appuyez sur le bouton pour demander une estimation de votre date de livraison.',
      'Expédié'    : '💡 Appuyez sur le bouton pour obtenir des informations sur votre livraison en cours.',
      'Livré'      : '💡 Vous avez bien reçu votre commande ? Appuyez pour nous laisser un retour.',
      'Annulé'     : '💡 Appuyez sur le bouton pour en savoir plus sur l\'annulation de votre commande.',
    };
    var waHint=waHints[statut]||'💡 Appuyez sur le bouton pour contacter notre équipe.';
    var waSuiviHtml='<div class="suivi-wa-hint">'+waHint+'</div><a class="suivi-wa-btn" href="'+waUrl+'" target="_blank">'+
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'+
      ' Contacter via WhatsApp</a>';
    result.innerHTML='<div class="suivi-card"><div class="suivi-num">Commande '+c.num+' — '+c.date+'</div><div class="suivi-statut '+(STATUT_CLASS[statut]||'statut-attente')+'">'+(STATUT_ICONS[statut]||'⏳')+' '+statut+'</div>'+raisonHtml+dateLivraisonHtml+'<div class="suivi-steps">'+stepsHtml+'</div>'+historiqueHtml+(function(){
      // Parser les articles : "Nom (Option) x1 = 55 000 Ar | ..."
      var items = c.produits ? c.produits.split(' | ') : [];
      var itemsHtml = items.map(function(item){
        // Format : "Nom produit (Option) x1 = 55 000 Ar"
        var match = item.match(/^(.+?)\s*x(\d+)\s*=\s*(.+)$/);
        if(!match) return '<div class="suivi-item"><span class="suivi-item-nom">'+item+'</span></div>';
        var nomComplet = match[1].trim();
        var qty = match[2].trim();
        var prix = match[3].trim();
        // Extraire option entre parenthèses si présente
        var nomMatch = nomComplet.match(/^(.+?)\s*\((.+)\)$/);
        var nom = nomMatch ? nomMatch[1].trim() : nomComplet;
        var option = nomMatch ? nomMatch[2].trim() : '';
        return '<div class="suivi-item">'+
          '<div class="suivi-item-nom">'+nom+'</div>'+
          (option ? '<div class="suivi-item-option">📌 '+option+'</div>' : '')+
          '<div class="suivi-item-prix">'+qty+' × '+prix+'</div>'+
        '</div>';
      }).join('');
      var totalHtml = c.total ? '<div class="suivi-total">Total : <strong>'+Number(c.total).toLocaleString('fr-MG')+' Ar</strong></div>' : '';
      var adresseHtml = c.adresse ? '<div class="suivi-adresse">📍 '+c.adresse+'</div>' : '';
      return '<div class="suivi-resume"><div class="suivi-resume-title">🛍️ Détail de la commande</div>'+itemsHtml+totalHtml+adresseHtml+'</div>';
    }())+waSuiviHtml+'</div>';
  }catch(err){
    result.innerHTML='<div class="suivi-error">❌ Erreur lors de la recherche. Réessayez.</div>';
  }
}
// ===== LOAD PRODUCTS =====
async function loadProducts(){
  showLoadingState('home-products');
  showLoadingState('shop-products');
  try {
    const { getProduitsActifs, getNotifsSite } = await import('./produits-supabase.js');
    const [data, notifs] = await Promise.all([getProduitsActifs(), getNotifsSite()]);
    if(!data || !data.length) throw new Error('Aucun produit retourné');

    products = data.map(function(p) {
      var imgs_principales = (p.produit_images || [])
        .filter(function(img){ return img.type === 'principale'; })
        .sort(function(a,b){ return a.ordre - b.ordre; });

      var imgs_couleur = (p.produit_images || [])
        .filter(function(img){ return img.type === 'couleur'; })
        .sort(function(a,b){ return a.ordre - b.ordre; });

      var emoji = imgs_principales.map(function(img){ return img.url; }).join(',');

      var photos = {};
      imgs_couleur.forEach(function(img, i){
        photos['photos_c' + (i+1)] = img.url;
      });

      return Object.assign({}, p, {
        name:          p.nom,
        cat:           p.categorie,
        price:         p.prix,
        prix_barre:    p.prix_barre || null,
        sous_categorie: p.sous_categorie || null,
        emoji:         emoji,
        couleurs:      Array.isArray(p.couleurs) ? p.couleurs.join(',') : (p.couleurs || ''),
        tailles:       Array.isArray(p.tailles)  ? p.tailles.join(',')  : (p.tailles  || ''),
        photos_c1:     photos.photos_c1 || null,
        photos_c2:     photos.photos_c2 || null,
        photos_c3:     photos.photos_c3 || null,
        photos_c4:     photos.photos_c4 || null,
        photos_c5:     photos.photos_c5 || null,
        stock:         p.stock || 0,
      });
    });

    renderNotifications(notifs);
    renderHome();
    renderShop();
    updateFavCount();
    showToast('✅ ' + products.length + ' produits chargés');
    return true;
  } catch(err) {
    console.error(err);
    showErrorState('home-products');
    showErrorState('shop-products');
    showToast('❌ Impossible de charger le catalogue', 'error');
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
    var btnHtml=p.stock===0?'<button class="view-btn" disabled>Indisponible</button>':'<button class="view-btn" onclick="event.stopPropagation();openProduct(\''+p.id+'\')">Voir le produit →</button>';
    var isFavCard = getFavoris().indexOf(String(p.id)) >= 0;
    var favCardBtn = '<button class="fav-card-btn'+(isFavCard?' active':'')+'" data-pid="'+p.id+'" onclick="event.stopPropagation();toggleFavori(\''+p.id+'\')" title="Favoris">'+FAV_SVG+'</button>';
    return '<div class="product-card" onclick="openProduct(\''+p.id+'\')">'+badge+favCardBtn+'<div class="prod-img">'+imgHtml+'</div><div class="prod-info"><div class="prod-name">'+p.name+'</div>'+(p.moyenne_avis?'<div class="prod-etoiles-moy">'+etoilesMoyenne(p.moyenne_avis.moyenne)+'<span class="prod-nb-avis">('+p.moyenne_avis.count+')</span></div>':'')+'<div class="prod-price">'+(p.prix_barre?'<span class="prix-barre">'+fmt(p.prix_barre)+'</span><span class="prix-promo">'+fmt(p.price)+'</span><span class="promo-badge">-'+Math.round((1-p.price/p.prix_barre)*100)+'%</span>':fmt(p.price))+'</div><div class="prod-viewers">👁️ <span class="viewer-count-'+p.id+'">'+v+' personne'+(v>1?'s':'')+' regardent ce produit</span></div><div class="prod-stock'+(p.stock<=3?' stock-low':'')+'">'+stockHtml+'</div>'+btnHtml+'</div></div>';
  }).join('')+'</div>';
}
var homeLimit = 4;

function renderHome(){
  renderCats('home-cats','filterHome');
  var all = filteredProducts();
  renderProductGrid('home-products', all.slice(0, homeLimit));
  renderVoirPlus(all);
  chargerRecommandations();
}

function renderVoirPlus(all){
  var container = document.getElementById('home-voir-plus');
  if(!container) return;
  var restant = all.length - homeLimit;
  if(restant <= 0){ container.innerHTML = ''; return; }
  container.innerHTML =
    '<div class="voir-plus-wrapper">'+
      '<p class="voir-plus-count">🛍️ '+restant+' autre'+(restant>1?'s':'')+' produit'+(restant>1?'s':'')+' à découvrir</p>'+
      '<button class="voir-plus-btn" onclick="voirPlusProduits()">'+
        'Voir plus de produits <span class="voir-plus-chevron">↓</span>'+
      '</button>'+
    '</div>';
}

function voirPlusProduits(){
  homeLimit += 4;
  var all = filteredProducts();
  renderProductGrid('home-products', all.slice(0, homeLimit));
  renderVoirPlus(all);
  setTimeout(function(){
    var grid = document.getElementById('home-products');
    if(grid) grid.scrollIntoView({behavior:'smooth', block:'end'});
  }, 100);
}
function renderShop(){renderCats('shop-cats','filterShop');renderProductGrid('shop-products',filteredAndSearched());}
function filterHome(c){activeFilter=c;homeLimit=4;renderHome();}
function filterShop(c){activeFilter=c;renderShop();}
// ===== PRIX DÉGRESSIF =====
function parsePrixDegressif(str) {
  // Parse "1:30000,2:27500,3:25000" → [{qty:1,prix:30000}, ...]
  if(!str) return [];
  return str.split(',').map(function(p){
    var parts = p.trim().split(':');
    return { qty: Number(parts[0])||1, prix: Number(parts[1])||0 };
  }).filter(function(p){ return p.prix > 0; });
}
function getPrixDegressif(paliers, qty) {
  // Retourne le prix pour une quantité donnée
  if(!paliers || !paliers.length) return null;
  // Trier par quantité croissante
  paliers = paliers.slice().sort(function(a,b){ return a.qty - b.qty; });
  var prixActuel = paliers[0].prix;
  for(var i = 0; i < paliers.length; i++) {
    if(qty >= paliers[i].qty) prixActuel = paliers[i].prix;
  }
  return prixActuel;
}
function renderPrixDegressifTable(paliers, qtyActuelle) {
  // Affiche le tableau des paliers
  if(!paliers || !paliers.length) return '';
  paliers = paliers.slice().sort(function(a,b){ return a.qty - b.qty; });
  var lastPrix = paliers[paliers.length-1].prix;
  var rows = paliers.map(function(p, i) {
    var isActive = qtyActuelle >= p.prix && (i === paliers.length-1 || qtyActuelle < paliers[i+1].qty);
    var label = i === paliers.length-1
      ? p.qty + ' articles et +' 
      : p.qty + ' article' + (p.qty > 1 ? 's' : '');
    return '<div class="degrv-row'+(isActive?' active':'')+'">'+
      '<span class="degrv-qty">'+label+'</span>'+
      '<span class="degrv-prix">'+fmt(p.prix)+' / article</span>'+
    '</div>';
  }).join('');
  return '<div class="prix-degressif"><div class="degrv-title">🏷️ Prix selon quantité</div>'+rows+'</div>';
}
// ===== FAVORIS =====
function getFavoris(){
  try{ return JSON.parse(localStorage.getItem('harvel_favoris')||'[]'); }
  catch(e){ return []; }
}
function saveFavoris(favs){
  try{ localStorage.setItem('harvel_favoris', JSON.stringify(favs)); }catch(e){}
}
var FAV_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

function toggleFavori(id){
  var favs = getFavoris();
  var idx = favs.indexOf(String(id));
  if(idx>=0){ favs.splice(idx,1); }
  else { favs.push(String(id)); }
  saveFavoris(favs);
  var isFav = favs.indexOf(String(id)) >= 0;
  // Mettre à jour le bouton fiche produit
  var btn = document.getElementById('fav-btn');
  if(btn){
    btn.classList.toggle('active', isFav);
    btn.innerHTML = FAV_SVG;
    btn.title = isFav ? 'Retirer des favoris' : 'Ajouter aux favoris';
  }
  // Mettre à jour les cartes produit dans la grille
  document.querySelectorAll('.fav-card-btn[data-pid="'+id+'"]').forEach(function(b){
    b.classList.toggle('active', isFav);
    b.innerHTML = FAV_SVG;
  });
  showToast(isFav ? '❤️ Ajouté aux favoris' : 'Retiré des favoris');
  updateFavCount();
  // Re-render la page favoris si on y est
  var pageFav = document.getElementById('page-favoris');
  if(pageFav && pageFav.classList.contains('active')) renderFavoris();
}

// ===== DRAWER COMMANDE (style Alibaba) =====
var drawerQty = 1;
var drawerColor = null;
var drawerColorIndex = -1;
var drawerSize = null;
var drawerOption = null;
var drawerPromo = null;

function openDrawer(){
  if(!currentProduct) return;
  var p = currentProduct;
  drawerQty = 1;
  drawerColor = null;
  drawerColorIndex = -1;
  drawerSize = null;
  drawerOption = null;
  drawerPromo = null;

  var photos = getPhotos(p);
  var thumb = document.getElementById('drawer-thumb');
  if(thumb){ thumb.src = photos[0]||''; thumb.style.display = photos[0]?'':'none'; }

  document.getElementById('drawer-product-name').textContent = p.name;
  document.getElementById('drawer-prix-main').textContent = fmt(p.price);
  var barreEl = document.getElementById('drawer-prix-barre');
  if(barreEl){ barreEl.textContent = p.prix_barre ? fmt(p.prix_barre) : ''; }
  var stockEl = document.getElementById('drawer-stock');
  if(stockEl){
    stockEl.textContent = p.stock===0?'❌ Rupture':p.stock<=3?'⚠️ '+p.stock+' en stock':'✅ En stock';
    stockEl.style.color = p.stock===0?'#e74c3c':p.stock<=3?'#f97316':'#3dbd00';
  }
  document.getElementById('drawer-qty-val').textContent = 1;
  document.getElementById('drawer-qty-stock').textContent = 'Stock : '+p.stock;

  // Couleurs
  var colors = getColors(p);
  var colorSection = document.getElementById('drawer-colors-section');
  var colorGrid = document.getElementById('drawer-color-grid');
  if(colors.length){
    colorSection.style.display = '';
    colorGrid.innerHTML = colors.map(function(c,i){
      var imgKey = ['photos_c1','photos_c2','photos_c3','photos_c4','photos_c5'][i];
      var imgUrl = p[imgKey] ? p[imgKey].split(',')[0] : '';
      var hex = getColorHex(c);
      var imgHtml = imgUrl
        ? '<img class="drawer-color-img" src="'+imgUrl+'" alt="'+c+'" onerror="this.src=\'\';this.style.background=\''+hex+'\'">'
        : '<div class="drawer-color-img" style="background:'+hex+';border:2px solid #eee;"></div>';
      return '<div class="drawer-color-item" data-color="'+c+'" data-ci="'+i+'" onclick="drawerSelectColor(\''+c+'\','+i+',this)">'+
        imgHtml+
        '<span class="drawer-color-label-text">'+c+'</span>'+
      '</div>';
    }).join('');
    document.getElementById('drawer-color-label').textContent = '— choisissez';
  } else {
    colorSection.style.display = 'none';
  }

  // Tailles
  var sizes = getSizes(p);
  var sizeSection = document.getElementById('drawer-sizes-section');
  var sizeGrid = document.getElementById('drawer-size-grid');
  if(sizes.length){
    sizeSection.style.display = '';
    var isOne = sizes.length===1 && sizes[0].toLowerCase().includes('one');
    sizeGrid.innerHTML = sizes.map(function(s){
      return '<button class="drawer-size-btn'+(isOne?' one-size':'')+'" onclick="drawerSelectSize(\''+s+'\',this)">'+s+'</button>';
    }).join('');
    if(isOne){ drawerSize = sizes[0]; document.getElementById('drawer-size-label').textContent = sizes[0]; }
    else document.getElementById('drawer-size-label').textContent = '— choisissez';
  } else {
    sizeSection.style.display = 'none';
  }

  // Options
  var optSection = document.getElementById('drawer-options-section');
  var optGrid = document.getElementById('drawer-option-grid');
  if(p.options){
    optSection.style.display = '';
    var opts = p.options.split(',').map(function(o){return o.trim();});
    optGrid.innerHTML = opts.map(function(opt){
      var parts = opt.split(':');
      var nom = parts[0].trim();
      var px = parts[1]?Number(parts[1].trim()):0;
      var qty = parts[2]?Number(parts[2].trim()):1;
      return '<button class="drawer-option-btn" data-nom="'+nom+'" data-prix="'+px+'" data-qty="'+qty+'" onclick="drawerSelectOption(\''+nom+'\','+px+','+qty+',this)">'+(px?nom+' — '+fmt(px):nom)+'</button>';
    }).join('');
    document.getElementById('drawer-option-label').textContent = '— choisissez';
  } else {
    optSection.style.display = 'none';
  }

  // Code promo
  var promoSection = document.getElementById('drawer-promo-section');
  if(p.codes_promo){ promoSection.style.display=''; } else { promoSection.style.display='none'; }
  var promoInput = document.getElementById('drawer-promo-input');
  var promoMsg = document.getElementById('drawer-promo-msg');
  if(promoInput) promoInput.value='';
  if(promoMsg){ promoMsg.textContent=''; promoMsg.className=''; }

  drawerUpdateSubtotal();

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer-commande').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer(){
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer-commande').classList.remove('open');
  document.body.style.overflow = '';
}

function drawerSelectColor(c, ci, el){
  drawerColor = c;
  drawerColorIndex = ci;
  document.querySelectorAll('.drawer-color-item').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('drawer-color-label').textContent = c;
  // Retirer l'erreur
  var colorSection = document.getElementById('drawer-colors-section');
  if(colorSection) colorSection.classList.remove('drawer-section-error');
  // Mettre à jour la miniature header
  var p = currentProduct;
  var imgKey = ['photos_c1','photos_c2','photos_c3','photos_c4','photos_c5'][ci];
  var imgUrl = p[imgKey] ? p[imgKey].split(',')[0] : '';
  var thumb = document.getElementById('drawer-thumb');
  if(thumb && imgUrl){ thumb.src = imgUrl; thumb.style.display=''; }
  // Mettre à jour le carrousel de la fiche
  updateCarouselForColor(ci);
  drawerUpdateSubtotal();
}

function drawerSelectSize(s, el){
  drawerSize = s;
  document.querySelectorAll('.drawer-size-btn').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('drawer-size-label').textContent = s;
  // Retirer l'erreur
  var sizeSection = document.getElementById('drawer-sizes-section');
  if(sizeSection) sizeSection.classList.remove('drawer-section-error');
  drawerUpdateSubtotal();
}

function drawerSelectOption(nom, prix, qty, el){
  drawerOption = { name: nom, price: prix, qty: qty };
  document.querySelectorAll('.drawer-option-btn').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('drawer-option-label').textContent = nom;
  drawerUpdateSubtotal();
}

function drawerChangeQty(delta){
  var p = currentProduct;
  if(!p) return;
  var newQty = drawerQty + delta;
  if(newQty < 1) return;
  if(newQty > p.stock){ showToast('⚠️ Stock max : '+p.stock,'warning'); return; }
  if(newQty > GROS_COMMANDE_LIMITE){
    showToast('📦 Pour '+GROS_COMMANDE_LIMITE+'+ articles, contactez-nous !','warning');
    var waMsg = 'Bonjour Harvel Store ! 👋 Je souhaite commander *'+p.name+'* en grande quantité ('+newQty+' articles). Pouvez-vous me proposer un tarif ? Merci !';
    window.open('https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(waMsg),'_blank');
    return;
  }
  drawerQty = newQty;
  document.getElementById('drawer-qty-val').textContent = drawerQty;

  // Gérer le blocage code promo si prix dégressif actif
  var hasDegrv = p.prix_degressif && parsePrixDegressif(p.prix_degressif).length > 0;
  var couponBloque = hasDegrv && drawerQty > 1;
  var promoInput = document.getElementById('drawer-promo-input');
  var promoBtn = document.querySelector('#drawer-promo-section .code-promo-btn');
  var promoMsg = document.getElementById('drawer-promo-msg');
  var promoSection = document.getElementById('drawer-promo-section');
  if(couponBloque){
    if(promoInput){ promoInput.disabled = true; promoInput.value = ''; }
    if(promoBtn) promoBtn.disabled = true;
    if(promoMsg){ promoMsg.className='option-bloque'; promoMsg.textContent='ℹ️ Code promo non applicable avec le prix dégressif'; }
    if(drawerPromo){ drawerPromo = null; }
  } else {
    if(promoInput) promoInput.disabled = false;
    if(promoBtn) promoBtn.disabled = false;
    if(promoMsg && promoMsg.className==='option-bloque'){ promoMsg.textContent=''; promoMsg.className=''; }
  }

  drawerUpdateSubtotal();
}

function drawerUpdateSubtotal(){
  var p = currentProduct;
  if(!p) return;
  var paliers = parsePrixDegressif(p.prix_degressif);
  var prix = paliers.length ? getPrixDegressif(paliers, drawerQty) : p.price;
  if(drawerOption && drawerOption.price > 0) prix = drawerOption.price;
  if(drawerPromo){
    var remise = drawerPromo.remise;
    if(remise.includes('%')){ prix = Math.round(prix*(1-parseFloat(remise)/100)); }
    else { prix = Math.max(0, prix - Number(remise)); }
  }
  var total = prix * (drawerOption && drawerOption.qty > 1 ? drawerOption.qty : drawerQty);
  document.getElementById('drawer-subtotal').textContent = fmt(total);
  // Mettre à jour le prix affiché
  document.getElementById('drawer-prix-main').textContent = fmt(prix);
}

async function drawerAppliquerPromo(){
  var p = currentProduct;
  if(!p) return;
  var hasDegrv = p.prix_degressif && parsePrixDegressif(p.prix_degressif).length > 0;
  var input = document.getElementById('drawer-promo-input');
  var msg = document.getElementById('drawer-promo-msg');
  if(hasDegrv && drawerQty > 1){
    if(msg){ msg.className='option-bloque'; msg.textContent='ℹ️ Code promo non applicable avec le prix dégressif'; }
    return;
  }
  var code = input ? input.value.trim().toUpperCase() : '';
  if(!code){ showToast('⚠️ Entrez un code promo','warning'); return; }
  msg.className='code-promo-msg'; msg.textContent='⏳ Vérification...';
  var found = null;
  try {
    const { supabase: sb } = await import('./supabase-client.js');
    const { data } = await sb.from('codes_promo').select('code,type,valeur,date_expiration,actif').eq('actif',true).eq('code',code).single();
    if(data){
      if(data.date_expiration && new Date(data.date_expiration) < new Date()){
        msg.className='code-promo-error'; msg.textContent='❌ Code expiré'; return;
      }
      found = { nom: data.code, remise: data.type==='pourcentage'?data.valeur+'%':String(data.valeur) };
    }
  } catch(e){}
  if(!found && p.codes_promo){
    p.codes_promo.split(',').forEach(function(c){
      var parts = c.trim().split(':');
      if(parts[0].trim().toUpperCase()===code) found={nom:parts[0].trim(),remise:parts[1]?parts[1].trim():''};
    });
  }
  if(!found){ msg.className='code-promo-error'; msg.textContent='❌ Code invalide'; drawerPromo=null; return; }
  drawerPromo = found;
  var label = found.remise.includes('%') ? '-'+found.remise : '-'+fmt(Number(found.remise));
  msg.className='code-promo-success'; msg.textContent='✅ '+found.nom+' appliqué ! '+label;
  drawerUpdateSubtotal();
}

function drawerAddToCart(){
  var p = currentProduct;
  if(!p) return;
  var colors = getColors(p), sizes = getSizes(p);
  var isOne = sizes.length===1 && sizes[0].toLowerCase().includes('one');

  // Réinitialiser les erreurs
  var colorSection = document.getElementById('drawer-colors-section');
  var sizeSection = document.getElementById('drawer-sizes-section');
  if(colorSection) colorSection.classList.remove('drawer-section-error');
  if(sizeSection) sizeSection.classList.remove('drawer-section-error');

  var hasError = false;
  if(colors.length && !drawerColor){
    if(colorSection) colorSection.classList.add('drawer-section-error');
    hasError = true;
  }
  if(sizes.length && !isOne && !drawerSize){
    if(sizeSection) sizeSection.classList.add('drawer-section-error');
    hasError = true;
  }
  if(hasError){
    // Scroller vers la première erreur
    var firstError = document.querySelector('.drawer-section-error');
    if(firstError) firstError.scrollIntoView({behavior:'smooth', block:'center'});
    showToast('⚠️ Veuillez compléter votre sélection','warning');
    return;
  }

  // Sync avec les variables globales pour réutiliser addToCartFromProduct
  selectedColor = drawerColor;
  selectedSize = drawerSize || (isOne ? sizes[0] : null);
  selectedOption = drawerOption;
  selectedQty = drawerQty;
  selectedCodePromo = drawerPromo ? { code: drawerPromo.nom, remise: drawerPromo.remise, prixFinal: null } : null;
  if(selectedCodePromo){
    var paliers = parsePrixDegressif(p.prix_degressif);
    var baseP = paliers.length ? getPrixDegressif(paliers, selectedQty) : p.price;
    var rem = selectedCodePromo.remise;
    selectedCodePromo.prixFinal = rem.includes('%') ? Math.round(baseP*(1-parseFloat(rem)/100)) : Math.max(0,baseP-Number(rem));
  }

  addToCartFromProduct();
  closeDrawer();
}

function drawerCommanderWA(){
  var p = currentProduct;
  if(!p) return;
  selectedColor = drawerColor;
  selectedSize = drawerSize;
  selectedOption = drawerOption;
  selectedQty = drawerQty;
  window.open(getWhatsAppUrl(p), '_blank');
  closeDrawer();
}
function updateFavCount(){
  var count = getFavoris().length;
  var navBadge = document.getElementById('fav-nav-count');
  if(navBadge){
    if(count > 0){
      navBadge.textContent = count;
      navBadge.style.display = 'inline-flex';
    } else {
      navBadge.style.display = 'none';
    }
  }
  var mobileCount = document.getElementById('mobile-fav-count');
  if(mobileCount) mobileCount.textContent = count;
}

function renderFavoris(){
  var el = document.getElementById('favoris-content');
  if(!el) return;
  var favs = getFavoris();
  if(!favs.length){
    el.innerHTML =
      '<div class="fav-empty">'+
        '<div class="fav-empty-icon">🤍</div>'+
        '<p>Vous n\'avez pas encore de favoris.</p>'+
        '<p style="font-size:.85rem;color:var(--muted);">Appuyez sur le cœur sur un produit pour l\'ajouter ici.</p>'+
        '<button class="hero-btn" style="background:var(--primary);color:#fff;margin-top:16px;" onclick="showPage(\'shop\')">🛍️ Découvrir les produits</button>'+
      '</div>';
    return;
  }
  var list = products.filter(function(p){ return favs.indexOf(String(p.id)) >= 0; });
  if(!list.length){
    el.innerHTML = '<div class="fav-empty"><div class="fav-empty-icon">🤍</div><p>Chargement...</p></div>';
    return;
  }
  el.innerHTML = '<div class="products">'+list.map(function(p){
    var ph = getPhotos(p);
    var v = getViewers(p.id);
    var imgHtml = ph.length > 0
      ? '<img src="'+ph[0]+'" alt="'+p.name+'" onerror="this.parentElement.innerHTML=\'📦\'"/>'
      : '<span>'+(p.emoji&&!p.emoji.startsWith('http')?p.emoji:'📦')+'</span>';
    var stockHtml = p.stock===0?'❌ Rupture':p.stock<=3?'⚠️ Plus que '+p.stock:'✅ En stock';
    return '<div class="product-card" onclick="openProduct(\''+p.id+'\')">'+
      '<button class="fav-card-btn active" data-pid="'+p.id+'" onclick="event.stopPropagation();toggleFavori(\''+p.id+'\')" title="Retirer des favoris">'+FAV_SVG+'</button>'+
      '<div class="prod-img">'+imgHtml+'</div>'+
      '<div class="prod-info">'+
        '<div class="prod-name">'+p.name+'</div>'+
        (p.moyenne_avis?'<div class="prod-etoiles-moy">'+etoilesMoyenne(p.moyenne_avis.moyenne)+'<span class="prod-nb-avis">('+p.moyenne_avis.count+')</span></div>':'')+
        '<div class="prod-price">'+(p.prix_barre?'<span class="prix-barre">'+fmt(p.prix_barre)+'</span><span class="prix-promo">'+fmt(p.price)+'</span><span class="promo-badge">-'+Math.round((1-p.price/p.prix_barre)*100)+'%</span>':fmt(p.price))+'</div>'+
        '<div class="prod-stock'+(p.stock<=3?' stock-low':'')+'">'+stockHtml+'</div>'+
        '<button class="view-btn" onclick="event.stopPropagation();openProduct(\''+p.id+'\')">Voir le produit →</button>'+
      '</div>'+
    '</div>';
  }).join('')+'</div>'+
  '<div style="text-align:center;margin-top:8px;"><p style="font-size:.82rem;color:var(--muted);">'+list.length+' produit'+(list.length>1?'s':'')+'</p></div>';
}

function openProduct(id){
  currentProduct=products.find(function(p){return p.id==id;});
  if(!currentProduct) return;
  selectedColor=null;selectedSize=null;selectedOption=null;selectedQty=1;selectedCodePromo=null;
  var p=currentProduct,colors=getColors(p),sizes=getSizes(p),mainPhotos=getPhotos(p);
  var v=getViewers(p.id);
  carouselIndex=0;

  // ── Construction de la liste COMPLÈTE d'images (Pinduoduo style) ──
  // On commence par toutes les images principales, puis on ajoute
  // les images couleur qui ne sont pas déjà présentes
  var allImages = mainPhotos.slice(); // copies des principales
  // Récupérer toutes les images couleur depuis produit_images
  var colorImages = (p.produit_images||[])
    .filter(function(img){ return img.type==='couleur'; })
    .sort(function(a,b){ return a.ordre-b.ordre; })
    .map(function(img){ return img.url; });
  colorImages.forEach(function(url){
    if(allImages.indexOf(url)<0) allImages.push(url);
  });

  var isFav = getFavoris().indexOf(String(p.id)) >= 0;
  var carouselHtml=allImages.length>0?allImages.map(function(u,i){return '<img src="'+u+'" class="'+(i===0?'active':'')+'" onerror="this.style.display=\'none\'"/>';}).join(''):'<div class="no-img">'+(p.emoji&&!p.emoji.startsWith('http')?p.emoji:'📦')+'</div>';
  var arrowHtml=allImages.length>1?'<button class="carousel-arrow prev" onclick="carouselPrev()">‹</button><button class="carousel-arrow next" onclick="carouselNext()">›</button>':'';
  var dotsHtml=allImages.map(function(_,i){return '<div class="carousel-dot '+(i===0?'active':'')+'" onclick="goToSlide('+i+')"></div>';}).join('');
  var thumbsHtml=allImages.length>1?'<div class="carousel-thumbs" id="carousel-thumbs">'+allImages.map(function(u,i){return '<img src="'+u+'" class="carousel-thumb '+(i===0?'active':'')+'" onclick="goToSlide('+i+')" onerror="this.style.display=\'none\'"/>';}).join('')+'</div>':'';
  var waUrl=getWhatsAppUrl(p);
  document.getElementById('product-detail').innerHTML=
    '<button class="back-to-shop" onclick="showPage(\'shop\')" style="margin-bottom:16px;width:auto;padding:8px 16px;">← Retour</button>'+
    '<div class="product-page">'+
      '<div><div class="carousel-wrap">'+
        '<button id="fav-btn" class="fav-btn'+(isFav?' active':'')+'" onclick="toggleFavori(\''+p.id+'\')" title="'+(isFav?'Retirer des favoris':'Ajouter aux favoris')+'">'+FAV_SVG+'</button>'+
        '<div class="carousel-main" id="carousel-main">'+carouselHtml+'</div>'+
        arrowHtml+
        '<div class="carousel-dots" id="carousel-dots">'+dotsHtml+'</div>'+
        thumbsHtml+
      '</div></div>'+
      '<div class="product-details">'+
(p.badge?'<div class="prod-badge-wrap" style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:4px;">'+p.badge.split(',').map(function(b){b=b.trim();return '<div class="prod-badge badge-'+b.toLowerCase()+'">'+b+'</div>';}).join('')+'</div>':'')+
        '<div class="pd-category">'+p.cat+(p.sous_categorie?' — '+p.sous_categorie:'')+'</div>'+
        '<div class="pd-name">'+p.name+'</div>'+
        (p.moyenne_avis?'<div class="pd-etoiles-moy">'+etoilesMoyenne(p.moyenne_avis.moyenne)+'<span class="pd-nb-avis">('+p.moyenne_avis.count+' avis)</span></div>':'')+
        '<div class="pd-price" id="pd-price">'+(p.prix_barre?'<span class="prix-barre">'+fmt(p.prix_barre)+'</span><span class="prix-promo">'+fmt(p.price)+'</span><span class="promo-badge">-'+Math.round((1-p.price/p.prix_barre)*100)+'%</span>':fmt(p.price))+'</div>'+
        (p.matiere?'<div class="pd-matiere">🧵 <strong>Matière :</strong> '+p.matiere+'</div>':'')+
        (p.description?'<div class="pd-desc">'+p.description+'</div>':'')+
        (p.prix_degressif ? renderPrixDegressifTable(parsePrixDegressif(p.prix_degressif), 1) : '')+
        '<div class="pd-viewers">👁️ <span class="viewer-count-'+p.id+'">'+v+' personne'+(v>1?'s':'')+' regardent ce produit</span></div>'+
        '<div class="prod-stock'+(p.stock<=3?' stock-low':'')+'" style="margin-bottom:14px;">'+(p.stock===0?'❌ Rupture de stock':p.stock<=3?'⚠️ Plus que '+p.stock+' en stock':'✅ En stock ('+p.stock+')')+'</div>'+
        '<button class="back-to-shop" onclick="showPage(\'shop\')">← Continuer mes achats</button>'+
      '</div>'+
    '</div>'+
    '<div id="avis-section" class="avis-section"></div>'+
    '<div class="sticky-cta" id="sticky-cta">'+
      '<div class="sticky-price" id="sticky-price">'+(p.prix_barre?'<span class="sticky-prix-barre">'+fmt(p.prix_barre)+'</span> <span class="sticky-prix-main">'+fmt(p.price)+'</span>':'<span class="sticky-prix-main">'+fmt(p.price)+'</span>')+'</div>'+
      '<div class="sticky-btns">'+
        '<button class="sticky-wa" onclick="openDrawer()" title="Commander via WhatsApp"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button>'+
        '<button class="sticky-cart-btn" onclick="openDrawer()"'+(p.stock===0?' disabled':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg> '+(p.stock===0?'Indisponible':'Ajouter au panier')+'</button>'+
      '</div>'+
    '</div>';
  window.location.hash = 'product-'+(currentProduct.slug || id);
  showPage('product');
  initCarouselSwipe();
  chargerAvis(p.sheet_id || p.id);
}
// ===== AVIS PRODUITS =====
// Étoiles illustrées avec demi-étoile selon moyenne
function etoilesMoyenne(moy) {
  var html = '';
  for(var i = 1; i <= 5; i++) {
    if(moy >= i) {
      html += '<span class="em-star full">★</span>';
    } else if(moy >= i - 0.5) {
      html += '<span class="em-star half">★</span>';
    } else {
      html += '<span class="em-star empty">☆</span>';
    }
  }
  return '<span class="etoiles-moy-wrap">'+html+'</span>';
}
function etoiles(note) {
  var s = '';
  for(var i = 1; i <= 5; i++) s += i <= note ? '★' : '☆';
  return '<span class="etoiles">'+s+'</span>';
}
async function chargerAvis(produitId) {
  var section = document.getElementById('avis-section');
  if(!section) return;
  section.innerHTML = '<div class="avis-loading">Chargement des avis...</div>';
  try {
    var url = API_URL+'?action=avis&produit_id='+produitId;
    var res = await fetch(url, {redirect:'follow'});
    var data = JSON.parse(await res.text());
    var avis = data.avis || [];
    var moy = avis.length ? (avis.reduce(function(s,a){return s+a.note;},0)/avis.length).toFixed(1) : null;
    var avisList = avis.length
      ? avis.map(function(a){
          return '<div class="avis-item">'+
            '<div class="avis-header">'+etoiles(a.note)+'<span class="avis-nom">'+a.nom+'</span><span class="avis-date">'+a.date+'</span></div>'+
            (a.commentaire?'<div class="avis-comment">'+a.commentaire+'</div>':'')+
          '</div>';
        }).join('')
      : '<div class="avis-empty">Aucun avis pour ce produit. Soyez le premier !</div>';
    section.innerHTML =
      '<div class="avis-titre">⭐ Avis clients'+(moy?' — <span class="avis-moy">'+moy+'/5</span> ('+avis.length+' avis)':'')+'</div>'+
      avisList+
      '<button class="avis-btn-ouvrir" onclick="toggleFormulaireAvis('+produitId+')">✍️ Laisser un avis</button>'+
      '<div id="avis-form-'+produitId+'" class="avis-form" style="display:none;">'+
        '<div class="avis-form-titre">Votre avis</div>'+
        '<div class="avis-note-wrap">'+
          '<span class="avis-note-label">Note :</span>'+
          '<div class="avis-etoiles-sel" id="etoiles-sel-'+produitId+'">'+
            [1,2,3,4,5].map(function(i){
              return '<span class="etoile-sel" data-note="'+i+'" onclick="selEtoile('+produitId+','+i+')">☆</span>';
            }).join('')+
          '</div>'+
        '</div>'+
        '<textarea id="avis-comment-'+produitId+'" class="avis-textarea" placeholder="Votre commentaire (optionnel)..."></textarea>'+
        '<input id="avis-nom-'+produitId+'" class="avis-input" type="text" placeholder="Votre prénom (ex: Jean Rakoto)"/>'+
        '<label class="avis-anon-label">'+
          '<input type="checkbox" id="avis-anon-'+produitId+'" onchange="toggleAnon('+produitId+')"/> Rester anonyme'+
        '</label>'+
        '<input id="avis-tel-'+produitId+'" class="avis-input" type="tel" placeholder="Votre téléphone * (requis)"/>'+
        '<div id="avis-msg-'+produitId+'" class="avis-msg"></div>'+
        '<button class="avis-submit-btn" onclick="soumettreAvis('+produitId+')">Envoyer mon avis</button>'+
      '</div>';
  } catch(e) {
    section.innerHTML = '<div class="avis-empty">Impossible de charger les avis.</div>';
  }
}
function toggleFormulaireAvis(produitId) {
  var form = document.getElementById('avis-form-'+produitId);
  if(form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}
function selEtoile(produitId, note) {
  var wrap = document.getElementById('etoiles-sel-'+produitId);
  if(!wrap) return;
  wrap.querySelectorAll('.etoile-sel').forEach(function(el, i) {
    el.textContent = i < note ? '★' : '☆';
    el.classList.toggle('active', i < note);
  });
  wrap.dataset.note = note;
}
function toggleAnon(produitId) {
  var cb = document.getElementById('avis-anon-'+produitId);
  var nomInput = document.getElementById('avis-nom-'+produitId);
  if(nomInput) {
    nomInput.disabled = cb && cb.checked;
    nomInput.placeholder = cb && cb.checked ? 'Anonyme' : 'Votre prénom (ex: Jean Rakoto)';
  }
}
async function soumettreAvis(produitId) {
  var wrap = document.getElementById('etoiles-sel-'+produitId);
  var note = wrap ? Number(wrap.dataset.note||0) : 0;
  var comment = document.getElementById('avis-comment-'+produitId);
  var nomEl = document.getElementById('avis-nom-'+produitId);
  var anonEl = document.getElementById('avis-anon-'+produitId);
  var telEl = document.getElementById('avis-tel-'+produitId);
  var msgEl = document.getElementById('avis-msg-'+produitId);
  if(note < 1) { msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Veuillez sélectionner une note.'; return; }
  if(!telEl||!telEl.value.trim()) { msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Votre téléphone est requis.'; return; }
  var payload = {
    produit_id: String(currentProduct.sheet_id || produitId),
    produit_nom: currentProduct ? currentProduct.name : '',
    note: note,
    commentaire: comment ? comment.value.trim() : '',
    nom: nomEl ? nomEl.value.trim() : '',
    anonyme: anonEl ? anonEl.checked : false,
    phone: telEl.value.trim(),
    date: new Date().toLocaleDateString('fr'),
    valide: false,
  };
  msgEl.className='avis-msg'; msgEl.textContent='⏳ Envoi en cours...';
  try {
    const { supabase: sb } = await import('./supabase-client.js');
    const { error: sbError } = await sb.from('avis').insert(payload);
    if(sbError) throw new Error(sbError.message);
    msgEl.className='avis-msg success';
    msgEl.textContent='✅ Merci ! Votre avis sera affiché après validation.';
    setTimeout(function(){ toggleFormulaireAvis(produitId); }, 2000);
  } catch(e) {
    msgEl.className='avis-msg error'; msgEl.textContent='❌ Erreur lors de l\'envoi.';
  }
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
// ===== QUANTITÉ + PRIX DÉGRESSIF =====
function changeProductQty(delta) {
  if(!currentProduct) return;
  var paliers = parsePrixDegressif(currentProduct.prix_degressif);
  var maxQty = currentProduct.stock;
  // Vérifier limite grosse commande
  var newQty = selectedQty + delta;
  if(newQty < 1) return;
  if(newQty > maxQty){ showToast('⚠️ Stock maximum : '+maxQty+' articles','warning'); return; }
  // Redirection WhatsApp au-delà de la limite
  if(newQty > GROS_COMMANDE_LIMITE) {
    var waMsg = 'Bonjour Harvel Store ! 👋 Je souhaite commander *'+currentProduct.name+'* en grande quantité ('+newQty+' articles). Pouvez-vous me proposer un tarif personnalisé ? Merci !';
    var waUrl = 'https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(waMsg);
    showToast('📦 Pour '+GROS_COMMANDE_LIMITE+'+ articles, contactez-nous !','warning');
    window.open(waUrl, '_blank');
    return;
  }
  selectedQty = newQty;
  // Mettre à jour l'affichage quantité
  var qtyDisplay = document.getElementById('qty-display');
  var qtyLabel = document.getElementById('selected-qty-label');
  if(qtyDisplay) qtyDisplay.textContent = selectedQty;
  if(qtyLabel) qtyLabel.textContent = selectedQty;
  // Mettre à jour le prix selon palier
  if(paliers.length) {
    var nouveauPrix = getPrixDegressif(paliers, selectedQty);
    var priceEl = document.getElementById('pd-price');
    if(priceEl) priceEl.textContent = fmt(nouveauPrix);
    // Mettre à jour le tableau dégressif (surligner le palier actif)
    var table = document.querySelector('.prix-degressif');
    if(table) {
      var paliersTries = paliers.slice().sort(function(a,b){return a.qty-b.qty;});
      table.querySelectorAll('.degrv-row').forEach(function(row, i) {
        var isActive = selectedQty >= paliersTries[i].qty &&
          (i === paliersTries.length-1 || selectedQty < paliersTries[i+1].qty);
        row.classList.toggle('active', isActive);
      });
    }
  }
  updateSummary();
  // Mettre à jour l'état des options (griser/dégriser les coupons)
  if(currentProduct && currentProduct.options) {
    var hasDegrv = currentProduct.prix_degressif && parsePrixDegressif(currentProduct.prix_degressif).length > 0;
    var couponBloque = hasDegrv && selectedQty > 1;
    var blocMsg = document.querySelector('.option-bloque');
    // Afficher/masquer le message
    if(couponBloque) {
      if(!blocMsg) {
        var msgEl = document.createElement('div');
        msgEl.className = 'option-bloque';
        msgEl.textContent = 'ℹ️ Coupon non applicable avec le prix dégressif';
        var specialOpts = document.querySelector('.special-options');
        if(specialOpts) specialOpts.parentNode.insertBefore(msgEl, specialOpts);
      }
    } else {
      if(blocMsg) blocMsg.remove();
    }
    // Griser/dégriser les boutons options
    document.querySelectorAll('.special-btn').forEach(function(btn){
      if(btn.dataset.qtyopt === '1' || !btn.dataset.qtyopt) {
        btn.disabled = couponBloque;
        btn.classList.toggle('disabled', couponBloque);
        // Désélectionner si bloqué
        if(couponBloque && btn.classList.contains('active')) {
          btn.classList.remove('active');
          selectedOption = null;
          var l = document.getElementById('selected-option-label');
          if(l) l.textContent = '— choisissez —';
        }
      }
    });
  }
}
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
  var p = currentProduct;
  var mainPhotos = getPhotos(p);
  var selectedColorPhotos = getColorPhotos(p, ci);

  // Toutes les images couleur (toutes couleurs confondues), triées par ordre
  var allColorPhotos = (p.produit_images||[])
    .filter(function(img){ return img.type==='couleur'; })
    .sort(function(a,b){ return a.ordre - b.ordre; })
    .map(function(img){ return img.url; });

  // Ordre : couleur sélectionnée en premier, puis autres couleurs, puis principales
  var combined = selectedColorPhotos.slice();
  allColorPhotos.forEach(function(u){
    if(combined.indexOf(u) < 0) combined.push(u);
  });
  mainPhotos.forEach(function(u){
    if(combined.indexOf(u) < 0) combined.push(u);
  });
  if(!combined.length) combined = mainPhotos;

  var main=document.getElementById('carousel-main');
  var dots=document.getElementById('carousel-dots');
  var thumbs=document.getElementById('carousel-thumbs');
  if(!main) return;
  carouselIndex=0;
  main.innerHTML=combined.map(function(u,i){return '<img src="'+u+'" class="'+(i===0?'active':'')+'" onerror="this.style.display=\'none\'"/>';}).join('');
  main._swipeInit=false;
  if(dots) dots.innerHTML=combined.map(function(_,i){return '<div class="carousel-dot '+(i===0?'active':'')+'" onclick="goToSlide('+i+')"></div>';}).join('');
  if(thumbs) thumbs.innerHTML=combined.map(function(u,i){return '<img src="'+u+'" class="carousel-thumb '+(i===0?'active':'')+'" onclick="goToSlide('+i+')" onerror="this.style.display=\'none\'"/>';}).join('');
  initCarouselSwipe();
}
function selectColor(c,i,btn){selectedColor=c;document.querySelectorAll('.color-btn-label').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-color-label');if(l)l.textContent=c;updateCarouselForColor(i);updateSummary();}
function selectSize(s,btn){selectedSize=s;document.querySelectorAll('.size-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-size-label');if(l)l.textContent=s;updateSummary();}
function selectOption(opt,prix,qtyOpt,btn){selectedOption={name:opt,price:prix,qty:qtyOpt||1};document.querySelectorAll('.special-btn').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');var l=document.getElementById('selected-option-label');if(l)l.textContent=opt;var pe=document.getElementById('pd-price');if(pe&&prix>0)pe.textContent=fmt(prix);updateSummary();}
function toggleSizeGuide(){var g=document.getElementById('size-guide');if(g)g.classList.toggle('show');}
function updateSummary(){
  var s=document.getElementById('selection-summary'),t=document.getElementById('summary-text');if(!s||!t) return;
  var parts=[];if(selectedColor)parts.push('Couleur : '+selectedColor);if(selectedSize)parts.push('Taille : '+selectedSize);if(selectedOption)parts.push('Option : '+selectedOption.name);
  if(parts.length){t.textContent=parts.join(' — ');s.style.display='block';}else s.style.display='none';
  // Sync sticky barre WA
  var stickyWa=document.querySelector('.sticky-wa');
  if(stickyWa&&currentProduct) stickyWa.href=getWhatsAppUrl(currentProduct);
  // Sync sticky prix
  var stickyPrice=document.getElementById('sticky-price');
  var priceEl=document.getElementById('pd-price');
  if(stickyPrice&&priceEl) stickyPrice.innerHTML=priceEl.innerHTML.replace(/class="prix-barre"/g,'class="sticky-prix-barre"').replace(/class="prix-promo"/g,'class="sticky-prix-main"').replace(/class="promo-badge"/g,'class="promo-badge"');
}
// ===== CODE PROMO =====
async function appliquerCodePromo() {
  var p = currentProduct;
  if(!p) return;
  if(p.prix_degressif && parsePrixDegressif(p.prix_degressif).length > 0 && selectedQty > 1) {
    showToast('⚠️ Code promo non applicable avec le prix dégressif','warning');
    return;
  }
  var input = document.getElementById('code-promo-input');
  var msg = document.getElementById('code-promo-msg');
  if(!input || !msg) return;
  var code = input.value.trim().toUpperCase();
  if(!code) { showToast('⚠️ Entrez un code promo','warning'); return; }

  msg.className = 'code-promo-msg'; msg.textContent = '⏳ Vérification...';

  var found = null;

  // 1. Chercher dans la table codes_promo Supabase
  try {
    const { supabase: sb } = await import('./supabase-client.js');
    const { data: codesSupabase } = await sb.from('codes_promo')
      .select('code, type, valeur, date_expiration, actif')
      .eq('actif', true)
      .eq('code', code)
      .single();
    if (codesSupabase) {
      if (codesSupabase.date_expiration && new Date(codesSupabase.date_expiration) < new Date()) {
        msg.className = 'code-promo-error';
        msg.textContent = '❌ Ce code promo a expiré';
        selectedCodePromo = null;
        return;
      }
      var remiseStr = codesSupabase.type === 'pourcentage'
        ? codesSupabase.valeur + '%'
        : String(codesSupabase.valeur);
      found = { nom: codesSupabase.code, remise: remiseStr, expire: '' };
    }
  } catch(e) { console.error('Erreur Supabase codes_promo:', e); }

  // 2. Si pas trouvé dans Supabase → chercher dans codes_promo du produit
  if (!found && p.codes_promo) {
    var codesDispos = p.codes_promo.split(',').map(function(c){ return c.trim(); });
    for(var i = 0; i < codesDispos.length; i++) {
      var parts = codesDispos[i].split(':');
      var nom = parts[0].trim().toUpperCase();
      if(nom === code) {
        found = { nom: nom, remise: parts[1]?parts[1].trim():'', expire: parts[2]?parts[2].trim():'' };
        break;
      }
    }
    if (found && found.expire) {
      var ep = found.expire.split('/');
      var expireDate = new Date(ep[2], ep[1]-1, ep[0]);
      if(expireDate < new Date()) {
        msg.className = 'code-promo-error';
        msg.textContent = '❌ Ce code promo a expiré';
        selectedCodePromo = null;
        return;
      }
    }
  }

  if(!found) {
    msg.className = 'code-promo-error';
    msg.textContent = '❌ Code promo invalide';
    selectedCodePromo = null;
    return;
  }

  // Calculer le prix avec remise
  var prixBase = document.getElementById('pd-price');
  var paliers = parsePrixDegressif(p.prix_degressif);
  var prixActuel = paliers.length ? getPrixDegressif(paliers, selectedQty) : p.price;
  var remise = found.remise;
  var prixRemise;
  var remiseLabel;
  if(remise.includes('%')) {
    var pct = parseFloat(remise);
    prixRemise = Math.round(prixActuel * (1 - pct/100));
    remiseLabel = '-' + pct + '%';
  } else {
    var montant = Number(remise);
    prixRemise = Math.max(0, prixActuel - montant);
    remiseLabel = '-' + fmt(montant);
  }
  // Appliquer
  selectedCodePromo = { code: found.nom, remise: remise, prixFinal: prixRemise };
  if(prixBase) {
    prixBase.innerHTML = '<span class="prix-barre">'+fmt(prixActuel)+'</span>'+
      '<span class="prix-promo">'+fmt(prixRemise)+'</span>'+
      '<span class="promo-badge">'+remiseLabel+'</span>';
  }
  msg.className = 'code-promo-success';
  msg.textContent = '✅ Code ' + found.nom + ' appliqué ! ' + remiseLabel;
  updateSummary();
}
function resetCodePromo() {
  selectedCodePromo = null;
  var input = document.getElementById('code-promo-input');
  var msg = document.getElementById('code-promo-msg');
  if(input) input.value = '';
  if(msg) { msg.textContent = ''; msg.className = ''; }
}
function addToCartFromProduct(){
  var p=currentProduct;if(!p) return;
  var colors=getColors(p),sizes=getSizes(p),isOne=sizes.length===1&&sizes[0].toLowerCase().includes('one');
  if(colors.length>0&&!selectedColor){showToast('⚠️ Veuillez choisir une couleur','warning');return;}
  if(sizes.length>0&&!isOne&&!selectedSize){showToast('⚠️ Veuillez choisir une taille','warning');return;}
  // Prix : option > dégressif > prix de base
  var paliers = parsePrixDegressif(p.prix_degressif);
  var prixDegressif = paliers.length ? getPrixDegressif(paliers, selectedQty) : null;
  var couponBloque = paliers.length > 0 && selectedQty > 1;
  var price, qtyReelle;
  if(selectedOption && selectedOption.qty > 1) {
    // Option multi-paires (Deux paires, Trois paires) — prix de l'option
    price = selectedOption.price;
    qtyReelle = selectedOption.qty;
  } else if(!couponBloque && selectedOption && selectedOption.price > 0) {
    // Option coupon applicable (qty = 1 ou pas de dégressif)
    price = selectedOption.price;
    qtyReelle = selectedQty;
  } else if(selectedCodePromo && !couponBloque) {
    // Code promo appliqué
    price = selectedCodePromo.prixFinal;
    qtyReelle = selectedQty;
  } else {
    // Prix dégressif ou prix normal
    price = prixDegressif || p.price;
    qtyReelle = selectedQty;
    if(couponBloque) { selectedOption = null; resetCodePromo(); }
  }
  var variant=[selectedColor,selectedSize,selectedOption?selectedOption.name:null].filter(Boolean).join(' — ');
  var cartKey=p.id+'_'+variant;
  var photos=getPhotos(p);
  var ex=cart.find(function(i){return i.cartKey===cartKey;});
  var emojiForAnim=p.emoji&&!p.emoji.startsWith('http')?p.emoji:'🛒';
  if(ex){
    if(ex.qty<p.stock){ex.qty++;showToast('✅ '+p.name+' mis à jour');animateToCart(emojiForAnim);}
    else{showToast('⚠️ Stock maximum atteint !','warning');return;}
  }else{
    var isPack = selectedOption && selectedOption.qty > 1;
    cart.push(Object.assign({},p,{price:price,variant:variant,cartKey:cartKey,qty:qtyReelle,is_pack:isPack,thumb:photos[0]||null,code_promo:selectedCodePromo?selectedCodePromo.code:null}));
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
  // Bouton panier flottant
  var fab = document.getElementById('fab-cart');
  var fabCount = document.getElementById('fab-cart-count');
  var fabTotal = document.getElementById('fab-cart-total');
  if(fab) {
    var currentPage = document.querySelector('.page.active');
    var isCartPage = currentPage && currentPage.id === 'page-cart';
    var isAvisPage = currentPage && currentPage.id === 'page-avis-cmd';
    fab.style.display = (count > 0 && !isCartPage && !isAvisPage) ? 'flex' : 'none';
    if(fabCount) fabCount.textContent = count;
    if(fabTotal) {
      var total = cart.reduce(function(s,i){return s+i.price*i.qty;},0);
      fabTotal.textContent = total.toLocaleString('fr') + ' Ar';
    }
  }
}
function renderCart(){
  var el=document.getElementById('cart-content');
  if(!cart.length){
    el.innerHTML='<div class="cart-empty"><div class="icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2d7a00" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg></div><p style="color:var(--primary);font-weight:600;">Votre panier est vide</p><p style="color:var(--muted);font-size:.9rem;">Découvrez nos produits !</p><br><button class="hero-btn" style="background:var(--primary);color:#fff;" onclick="showPage(\'shop\')">Voir la boutique</button></div>';
    return;
  }
  var sub=cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  var itemsHtml=cart.map(function(i){
    var imgHtml=i.thumb?'<img src="'+i.thumb+'" onerror="this.parentElement.innerHTML=\'📦\'"/>':(i.emoji&&!i.emoji.startsWith('http')?'<span>'+i.emoji+'</span>':'<span>📦</span>');
    var qtyControls = i.is_pack
      ? '<div class="ci-qty ci-pack"><span class="pack-label">📦 Pack fixe</span><span>'+i.qty+'</span></div>'
      : '<div class="ci-qty"><button class="qty-btn" onclick="changeQty(\''+i.cartKey+'\',-1)">−</button><span>'+i.qty+'</span><button class="qty-btn" onclick="changeQty(\''+i.cartKey+'\',1)">+</button></div>';
    return '<div class="cart-item"><div class="ci-icon">'+imgHtml+'</div><div class="ci-info"><div class="ci-name">'+i.name+'</div>'+(i.variant?'<div class="ci-variant">📌 '+i.variant+'</div>':'')+'<div class="ci-price">'+fmt(i.price)+' × '+i.qty+' = '+fmt(i.price*i.qty)+'</div>'+qtyControls+'</div><button class="remove-btn" onclick="removeFromCart(\''+i.cartKey+'\')">🗑️</button></div>';
  }).join('');
  el.innerHTML='<div class="section-title">Mon Panier</div><div class="cart-items">'+itemsHtml+'</div><div class="cart-summary"><div class="summary-row"><span>Articles ('+cart.reduce(function(s,i){return s+i.qty;},0)+')</span><span>'+fmt(sub)+'</span></div><div class="summary-row"><span>Livraison</span><span>Selon votre zone</span></div><div class="summary-row summary-total"><span>Total produits</span><span>'+fmt(sub)+'</span></div><button class="checkout-btn" onclick="goToOrder()">🛍️ Passer la commande</button></div>';
}
function changeQty(key,d){
  var item=cart.find(function(x){return x.cartKey===key;});
  if(!item) return;
  if(item.is_pack){ showToast('📦 Prix de pack fixe — supprimez et rechoisissez depuis la fiche produit','warning'); return; }
  var prod=products.find(function(x){return x.id==item.id;});
  var newQty = item.qty + d;
  if(newQty <= 0){ cart=cart.filter(function(x){return x.cartKey!==key;}); updateCartCount(); renderCart(); return; }
  if(prod && newQty > prod.stock){ showToast('⚠️ Stock maximum atteint !','warning'); return; }
  item.qty = newQty;
  // Recalculer le prix dégressif si applicable
  if(prod && prod.prix_degressif) {
    var paliers = parsePrixDegressif(prod.prix_degressif);
    if(paliers.length) {
      item.price = getPrixDegressif(paliers, item.qty);
    }
  }
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
    var miniQtyControls = i.is_pack
      ? '<div class="mini-ci-qty"><span class="pack-label-mini">📦 '+i.qty+'</span></div>'
      : '<div class="mini-ci-qty"><button class="mini-qty-btn" onclick="miniChangeQty(\''+i.cartKey+'\',-1)">−</button><span style="font-weight:600;min-width:16px;text-align:center;">'+i.qty+'</span><button class="mini-qty-btn" onclick="miniChangeQty(\''+i.cartKey+'\',1)">+</button></div>';
    return '<div class="mini-cart-item"><div class="mini-ci-img">'+thumb+'</div><div class="mini-ci-info"><div class="mini-ci-name">'+i.name+'</div>'+variant+'<div class="mini-ci-price">'+fmt(i.price*i.qty)+'</div></div>'+miniQtyControls+'<button class="mini-remove-btn" onclick="miniRemove(\''+i.cartKey+'\')">🗑️</button></div>';
  }).join('');
}
function miniChangeQty(key,d){
  var item=cart.find(function(x){return x.cartKey===key;});
  if(!item) return;
  if(item.is_pack){ showToast('📦 Prix de pack fixe — supprimez et rechoisissez depuis la fiche produit','warning'); return; }
  var prod=products.find(function(x){return x.id==item.id;});
  var newQty = item.qty + d;
  if(newQty <= 0){ cart=cart.filter(function(x){return x.cartKey!==key;}); updateCartCount(); renderMiniCart(); return; }
  if(prod && newQty > prod.stock){ showToast('⚠️ Stock maximum atteint !','warning'); return; }
  item.qty = newQty;
  // Recalculer le prix dégressif si applicable
  if(prod && prod.prix_degressif) {
    var paliers = parsePrixDegressif(prod.prix_degressif);
    if(paliers.length) {
      item.price = getPrixDegressif(paliers, item.qty);
    }
  }
  updateCartCount();
  renderMiniCart();
}
function miniRemove(key){
  cart=cart.filter(function(x){return x.cartKey!==key;});
  updateCartCount();
  renderMiniCart();
  if(!cart.length) showToast('Panier vide — ajoutez des articles','warning');
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
// ===== GÉNÉRER UN TOKEN DE SUIVI =====
function genTrackToken() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var token = '';
  for(var i = 0; i < 12; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

// ===== ENREGISTRER COMMANDE DANS SUPABASE =====
async function enregistrerCommandeSupabase(orderNum, trackToken, name, phone, address, note, cartItems, total, codePromo) {
  try {
    const { supabase: sb } = await import('./supabase-client.js');

    // 1. Insérer dans commandes
    // Générer l'UUID côté client pour éviter le SELECT après INSERT
    var cmdId = crypto.randomUUID();

    var { error: cmdErr } = await sb.from('commandes').insert({
      id:               cmdId,
      numero:           orderNum,
      client_nom:       name,
      client_phone:     phone,
      adresse_livraison: address,
      notes:            note || null,
      total:            total,
      coupon_code:      codePromo || null,
      track_token:      trackToken,
      statut:           'en_attente',
      source:           'site',
    });

    if(cmdErr) { console.error('Supabase commande insert error:', cmdErr.message); return; }

    // 2. Insérer les articles dans commandes_items
    var items = cartItems.map(function(i) {
      return {
        commande_id: cmdId,
        produit_id:  String(i.id),
        produit_nom: i.name,
        variante:    i.variant || null,
        prix:        i.price,
        quantite:    i.qty,
      };
    });
    var { error: itemsErr } = await sb.from('commandes_items').insert(items);
    if(itemsErr) console.error('Supabase items insert error:', itemsErr.message);

  } catch(e) {
    console.error('Erreur enregistrement Supabase:', e);
  }
}

async function submitOrder(){
  var name=document.getElementById('f-name').value.trim();
  var phone=document.getElementById('f-phone').value.trim();
  var address=document.getElementById('f-address').value.trim();
  var note=document.getElementById('f-note').value.trim();
  if(!name||!phone||!address){showToast('⚠️ Veuillez remplir tous les champs obligatoires.','warning');return;}
  if(!cart.length){showToast('⚠️ Votre panier est vide.','warning');return;}
  var btn=document.getElementById('submit-btn');btn.disabled=true;btn.textContent='⏳ Envoi en cours...';

  // Générer le track_token côté client
  var trackToken = genTrackToken();
  var total = cart.reduce(function(s,i){return s+i.price*i.qty;},0);
  var codePromo = cart.length>0&&cart[0].code_promo?cart[0].code_promo:undefined;

  var payload={
    customer:{name:name,phone:phone,address:address,note:note},
    items:cart.map(function(i){return {id:i.id,name:i.name+(i.variant?' ('+i.variant+')':''),price:i.price,qty:i.qty};}),
    code_promo: codePromo,
    total: total,
  };

  try{
    // ── Envoi vers Apps Script (principal) ──
    var res=await fetch(API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)});
    var data=await res.json();
    if(!data.success) throw new Error(data.error);
    var orderNum=data.commande;
    // Utiliser le token retourné par Apps Script (il génère le sien)
    var finalToken = data.track_token || trackToken;

    // ── Envoi vers Supabase en parallèle (ne bloque pas) ──
    var cartSnapshot = cart.map(function(i){ return Object.assign({},i); });
    enregistrerCommandeSupabase(orderNum, finalToken, name, phone, address, note, cartSnapshot, total, codePromo);

    // ── Affichage page succès ──
    document.getElementById('success-order-num').textContent='📋 '+orderNum;
    if(finalToken) {
      var lienSuivi = window.location.origin + '/#suivi-' + orderNum + '-' + finalToken;
      var lienEl = document.getElementById('success-lien-suivi');
      if(lienEl) {
        lienEl.href = lienSuivi;
        lienEl.style.display = 'inline-flex';
        lienEl.dataset.lien = lienSuivi;
      }
    }
    var waMsg='Bonjour Harvel Store ! 👋\n\nJe viens de passer une commande et je souhaite garder une trace de mon numéro :\n📋 *'+orderNum+'*\n\nMerci !';
    document.getElementById('wa-order-btn').href='https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(waMsg);

    // ── Décrémenter stock Supabase ──
    cart.forEach(async function(item){
      var prod=products.find(function(p){return p.id==item.id;});
      if(prod){
        prod.stock=Math.max(0,prod.stock-item.qty);
        try {
          const { supabase: sb } = await import('./supabase-client.js');
          await sb.from('produits').update({ stock: prod.stock }).eq('id', prod.id);
        } catch(e) { console.error('Stock update error:', e); }
      }
    });

    // ── Résumé commande dans page success ──
    var resumeItems = cart.map(function(i){
      var option = i.variant ? '<div class="suivi-item-option">📌 '+i.variant+'</div>' : '';
      return '<div class="suivi-item">'+
        '<div class="suivi-item-nom">'+i.name+'</div>'+
        option+
        '<div class="suivi-item-prix">'+i.qty+' × '+fmt(i.price)+'</div>'+
      '</div>';
    }).join('');
    var resumeEl = document.getElementById('success-resume');
    if(resumeEl){
      resumeEl.innerHTML =
        '<div class="suivi-resume-title">🛍️ Détail de votre commande</div>'+
        resumeItems+
        '<div class="suivi-total">Total : <strong>'+fmt(total)+'</strong></div>'+
        '<div class="suivi-adresse">📍 '+address+'</div>';
      resumeEl.style.display = 'block';
    }
    ['f-name','f-phone','f-address','f-note'].forEach(function(id){document.getElementById(id).value='';});
    cart=[];updateCartCount();showPage('success');
  }catch(err){showToast('❌ Erreur lors de l\'envoi. Réessayez.','error');}
  finally{btn.disabled=false;btn.textContent='✅ Confirmer la commande';}
}
function resetAndGoHome(){
  // Réafficher la nav et footer cachés par la page avis-cmd
  var nav = document.querySelector('nav');
  var footer = document.querySelector('footer');
  if(nav) nav.style.display = '';
  if(footer) footer.style.display = '';
  activeFilter='Tous';searchQuery='';showPage('home');
}
function toggleMenu(){
  document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}
function showPage(p){
  // Toujours réafficher la nav et footer (cachés par la page avis-cmd)
  var nav = document.querySelector('nav');
  var footer = document.querySelector('footer');
  if(nav) nav.style.display = '';
  if(footer) footer.style.display = '';
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.nav-links button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('page-'+p).classList.add('active');
  var nb=document.getElementById('nav-'+p);if(nb)nb.classList.add('active');
  if(p==='home') renderHome();
  if(p==='shop') renderShop();
  if(p==='favoris') renderFavoris();
  if(p==='cart') {
    renderCart();
    // Cacher le bouton flottant sur la page panier
    var fab = document.getElementById('fab-cart');
    if(fab) fab.style.display = 'none';
  } else {
    // Réafficher le bouton flottant si panier non vide
    updateCartCount();
  }
  if(p==='avis-cmd') {} // contenu généré dynamiquement
  // Ne pas écraser le hash si on est sur un lien suivi avec token
  var currentHash = window.location.hash.replace('#','');
  if(p !== 'product' && !currentHash.startsWith('suivi-')) {
    window.location.hash = p==='home' ? '' : p;
  }
  window.scrollTo(0,0);
}
function showToast(msg,type){
  var t=document.getElementById('toast');t.textContent=msg;t.className='toast show '+(type||'');
  setTimeout(function(){t.classList.remove('show');},2800);
}
// ===== RECOMMANDATIONS =====
var recIndex = 0;
var recData = [];
var recTimer = null;
async function chargerRecommandations() {
  var wrap = document.getElementById('recommandations-carrousel');
  if(!wrap) return;
  try {
    const { supabase: sb } = await import('./supabase-client.js');
    const { data, error } = await sb.from('recommandations')
      .select('note, texte, nom, anonyme, date')
      .eq('valide', true)
      .order('created_at', { ascending: false });
    if(error) throw new Error(error.message);
    recData = (data || []).map(function(r) {
      return {
        note: r.note,
        texte: r.texte,
        nom: r.anonyme ? 'Anonyme' : (r.nom || 'Client'),
        date: r.date || '',
      };
    });
    if(!recData.length) {
      wrap.innerHTML = '<div class="rec-empty">Soyez le premier à témoigner ! <button class="rec-btn-temoigner" onclick="showPage(\'about\')">✍️ Laisser un témoignage</button></div>';
      return;
    }
    renderCarrouselRec();
  } catch(e) {
    wrap.innerHTML = '';
  }
}
function renderCarrouselRec() {
  var wrap = document.getElementById('recommandations-carrousel');
  if(!wrap || !recData.length) return;
  var r = recData[recIndex];
  var etoiles = '';
  for(var i=1;i<=5;i++) etoiles += i<=r.note ? '★' : '☆';
  wrap.innerHTML =
    '<div class="rec-card">'+
      '<div class="rec-etoiles">'+etoiles+'</div>'+
      '<div class="rec-texte">"'+r.texte+'"</div>'+
      '<div class="rec-footer">'+
        '<span class="rec-nom">— '+r.nom+'</span>'+
        (r.date?'<span class="rec-date">'+r.date+'</span>':'')+
      '</div>'+
    '</div>'+
    '<div class="rec-nav">'+
      '<button class="rec-nav-btn" onclick="recNavigue(-1)">‹</button>'+
      '<div class="rec-dots">'+
        recData.map(function(_,i){
          return '<span class="rec-dot'+(i===recIndex?' active':'')+'" onclick="recGoTo('+i+')"></span>';
        }).join('')+
      '</div>'+
      '<button class="rec-nav-btn" onclick="recNavigue(1)">›</button>'+
    '</div>'+
    '<div style="text-align:center;margin-top:12px;">'+
      '<button class="rec-btn-temoigner" onclick="showPage(\'about\')">✍️ Laissez votre témoignage</button>'+
    '</div>';
  // Auto-défilement toutes les 4 secondes
  if(recTimer) clearInterval(recTimer);
  recTimer = setInterval(function(){ recNavigue(1); }, 4000);
}
function recNavigue(dir) {
  recIndex = (recIndex + dir + recData.length) % recData.length;
  renderCarrouselRec();
}
function recGoTo(i) {
  recIndex = i;
  renderCarrouselRec();
}
function selEtoileRec(note) {
  var wrap = document.getElementById('etoiles-rec');
  if(!wrap) return;
  wrap.querySelectorAll('.etoile-sel').forEach(function(el, i) {
    el.textContent = i < note ? '★' : '☆';
    el.classList.toggle('active', i < note);
  });
  wrap.dataset.note = note;
}
function toggleAnonRec() {
  var cb = document.getElementById('rec-anon');
  var nomInput = document.getElementById('rec-nom');
  if(nomInput) {
    nomInput.disabled = cb && cb.checked;
    nomInput.placeholder = cb && cb.checked ? 'Anonyme' : 'Votre prénom (ex: Jean Rakoto)';
  }
}
async function soumettreRec() {
  var wrap = document.getElementById('etoiles-rec');
  var note = wrap ? Number(wrap.dataset.note||5) : 5;
  var texteEl = document.getElementById('rec-texte');
  var nomEl   = document.getElementById('rec-nom');
  var anonEl  = document.getElementById('rec-anon');
  var telEl   = document.getElementById('rec-tel');
  var msgEl   = document.getElementById('rec-msg');
  if(!texteEl||!texteEl.value.trim()) { msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Veuillez écrire un témoignage.'; return; }
  if(!telEl||!telEl.value.trim()) { msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Votre téléphone est requis.'; return; }
  var payload = {
    note: note,
    texte: texteEl.value.trim(),
    nom: nomEl ? nomEl.value.trim() : '',
    anonyme: anonEl ? anonEl.checked : false,
    phone: telEl.value.trim(),
    date: new Date().toLocaleDateString('fr'),
    valide: false,
  };
  msgEl.className='avis-msg'; msgEl.textContent='⏳ Envoi en cours...';
  try {
    const { supabase: sb } = await import('./supabase-client.js');
    const { error: sbError } = await sb.from('recommandations').insert(payload);
    if(sbError) throw new Error(sbError.message);
    msgEl.className='avis-msg success';
    msgEl.textContent='✅ Merci ! Votre témoignage sera affiché après validation.';
    if(texteEl) texteEl.value='';
    if(nomEl) nomEl.value='';
    if(telEl) telEl.value='';
  } catch(e) {
    msgEl.className='avis-msg error'; msgEl.textContent='❌ Erreur lors de l\'envoi.';
  }
}
// ===== FORMULAIRE AVIS POST-LIVRAISON =====
var avisFormData = {}; // stocke les notes et commentaires par produit
async function ouvrirFormulaireAvis(numCommande) {
  // Cacher nav et footer
  var nav = document.querySelector('nav');
  var footer = document.querySelector('footer');
  if(nav) nav.style.display = 'none';
  if(footer) footer.style.display = 'none';
  // Afficher la page
  document.querySelectorAll('.page').forEach(function(p){ p.style.display='none'; });
  var page = document.getElementById('page-avis-cmd');
  if(page) page.style.display = 'block';
  var content = document.getElementById('avis-cmd-content');
  if(!content) return;
  content.innerHTML = '<div class="avis-cmd-loading">⏳ Chargement de votre formulaire...</div>';
  try {
    var url = API_URL + '?action=commande_avis&num=' + encodeURIComponent(numCommande);
    var res = await fetch(url, {redirect:'follow'});
    var data = JSON.parse(await res.text());
    if(!data.success || !data.items || !data.items.length) {
      content.innerHTML = '<div class="avis-cmd-error"><p>⚠️ Commande introuvable ou déjà évaluée.</p><button class="avis-cmd-retour" onclick="resetAndGoHome()">← Retour à la boutique</button></div>';
      return;
    }
    avisFormData = { numCommande: numCommande, items: data.items, notes: {}, commentaires: {} };
    // Générer les sections avis par produit
    var produitsHtml = data.items.map(function(item, idx) {
      return '<div class="avis-cmd-produit">'+
        '<div class="avis-cmd-produit-nom">🛍️ '+item.nom+'</div>'+
        '<div class="avis-note-wrap">'+
          '<span class="avis-note-label">Votre note :</span>'+
          '<div class="avis-etoiles-sel" id="etoiles-prod-'+idx+'" data-note="0">'+
            [1,2,3,4,5].map(function(i){
              return '<span class="etoile-sel" onclick="selEtoileProd('+idx+','+i+')">☆</span>';
            }).join('')+
          '</div>'+
        '</div>'+
        '<textarea class="avis-textarea" id="comment-prod-'+idx+'" placeholder="Votre commentaire sur ce produit (optionnel)..."></textarea>'+
      '</div>';
    }).join('');
    content.innerHTML =
      '<div class="avis-cmd-wrap">'+
        '<div class="avis-cmd-header">'+
          '<div class="avis-cmd-logo">🛍️ Harvel Store</div>'+
          '<h2 class="avis-cmd-titre">Votre avis compte !</h2>'+
          '<p class="avis-cmd-sous-titre">Commande <strong>'+numCommande+'</strong> — Merci pour votre confiance 😊</p>'+
        '</div>'+
        '<div class="avis-cmd-section">'+
          '<div class="avis-cmd-section-titre">⭐ Vos avis sur les produits</div>'+
          produitsHtml+
        '</div>'+
        '<div class="avis-cmd-section">'+
          '<div class="avis-cmd-section-titre">💬 Votre expérience avec Harvel Store</div>'+
          '<div class="avis-cmd-produit">'+
            '<div class="avis-note-wrap">'+
              '<span class="avis-note-label">Note globale :</span>'+
              '<div class="avis-etoiles-sel" id="etoiles-rec-cmd" data-note="0">'+
                [1,2,3,4,5].map(function(i){
                  return '<span class="etoile-sel" onclick="selEtoileRecCmd('+i+')">☆</span>';
                }).join('')+
              '</div>'+
            '</div>'+
            '<textarea class="avis-textarea" id="rec-texte-cmd" placeholder="Partagez votre expérience globale avec Harvel Store..."></textarea>'+
          '</div>'+
        '</div>'+
        '<div class="avis-cmd-section">'+
          '<div class="avis-cmd-section-titre">👤 Vos informations</div>'+
          '<input id="avis-cmd-nom" class="avis-input" type="text" placeholder="Votre prénom (ex: Jean R.)"/>'+
          '<label class="avis-anon-label">'+
            '<input type="checkbox" id="avis-cmd-anon" onchange="toggleAnonCmd()"/> Rester anonyme'+
          '</label>'+
          '<input id="avis-cmd-tel" class="avis-input" type="tel" placeholder="Votre téléphone * (requis pour vérification)"/>'+
        '</div>'+
        '<div id="avis-cmd-msg" class="avis-msg" style="margin:10px 0;"></div>'+
        '<button class="avis-submit-btn" id="btn-envoyer-avis" onclick="soumettreAvisCmd()">✅ Envoyer mes avis</button>'+
        '<button class="avis-cmd-retour" onclick="resetAndGoHome()">← Retour à la boutique</button>'+
      '</div>';
  } catch(e) {
    content.innerHTML = '<div class="avis-cmd-error"><p>❌ Erreur de chargement. Veuillez réessayer.</p><button class="avis-cmd-retour" onclick="resetAndGoHome()">← Retour</button></div>';
  }
}
function selEtoileProd(idx, note) {
  var wrap = document.getElementById('etoiles-prod-'+idx);
  if(!wrap) return;
  wrap.querySelectorAll('.etoile-sel').forEach(function(el, i) {
    el.textContent = i < note ? '★' : '☆';
    el.classList.toggle('active', i < note);
  });
  wrap.dataset.note = note;
}
function selEtoileRecCmd(note) {
  var wrap = document.getElementById('etoiles-rec-cmd');
  if(!wrap) return;
  wrap.querySelectorAll('.etoile-sel').forEach(function(el, i) {
    el.textContent = i < note ? '★' : '☆';
    el.classList.toggle('active', i < note);
  });
  wrap.dataset.note = note;
}
function toggleAnonCmd() {
  var cb = document.getElementById('avis-cmd-anon');
  var nomInput = document.getElementById('avis-cmd-nom');
  if(nomInput) {
    nomInput.disabled = cb && cb.checked;
    nomInput.placeholder = cb && cb.checked ? 'Anonyme' : 'Votre prénom (ex: Jean R.)';
  }
}
async function soumettreAvisCmd() {
  var numCommande = avisFormData.numCommande;
  var items = avisFormData.items || [];
  var msgEl = document.getElementById('avis-cmd-msg');
  var telEl = document.getElementById('avis-cmd-tel');
  var nomEl = document.getElementById('avis-cmd-nom');
  var anonEl = document.getElementById('avis-cmd-anon');
  var recTexte = document.getElementById('rec-texte-cmd');
  var recWrap = document.getElementById('etoiles-rec-cmd');
  // Vérifications
  if(!telEl || !telEl.value.trim()) {
    msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Votre téléphone est requis.'; return;
  }
  var hasNote = false;
  items.forEach(function(item, idx) {
    var wrap = document.getElementById('etoiles-prod-'+idx);
    if(wrap && Number(wrap.dataset.note) > 0) hasNote = true;
  });
  if(!hasNote) {
    msgEl.className='avis-msg error'; msgEl.textContent='⚠️ Veuillez noter au moins un produit.'; return;
  }
  msgEl.className='avis-msg'; msgEl.textContent='⏳ Envoi en cours...';
  var phone = telEl.value.trim();
  var nom = nomEl ? nomEl.value.trim() : '';
  var anonyme = anonEl ? anonEl.checked : false;
  var erreurs = [];
  // Soumettre les avis produits via Supabase
  const { supabase: sb } = await import('./supabase-client.js');
  for(var idx = 0; idx < items.length; idx++) {
    var wrap = document.getElementById('etoiles-prod-'+idx);
    var note = wrap ? Number(wrap.dataset.note) : 0;
    if(note < 1) continue;
    var commentEl = document.getElementById('comment-prod-'+idx);
    var payload = {
      produit_id: String(items[idx].id || idx),
      produit_nom: items[idx].nom,
      note: note,
      commentaire: commentEl ? commentEl.value.trim() : '',
      nom: nom, anonyme: anonyme, phone: phone,
      date: new Date().toLocaleDateString('fr'),
      valide: false,
    };
    try {
      const { error: sbError } = await sb.from('avis').insert(payload);
      if(sbError && sbError.message !== 'Vous avez déjà laissé un avis pour ce produit') {
        erreurs.push(items[idx].nom + ' : ' + sbError.message);
      }
    } catch(e) { erreurs.push(items[idx].nom); }
  }
  // Soumettre la recommandation si remplie via Supabase
  var recNote = recWrap ? Number(recWrap.dataset.note) : 0;
  var recTexteVal = recTexte ? recTexte.value.trim() : '';
  if(recNote > 0 || recTexteVal) {
    var recPayload = {
      note: recNote || 5,
      texte: recTexteVal || 'Client satisfait ✅',
      nom: nom, anonyme: anonyme, phone: phone,
      date: new Date().toLocaleDateString('fr'),
      valide: false,
    };
    try {
      await sb.from('recommandations').insert(recPayload);
    } catch(e) {}
  }
  if(erreurs.length) {
    msgEl.className='avis-msg error';
    msgEl.textContent='⚠️ Certains avis n\'ont pas pu être envoyés : '+erreurs.join(', ');
  } else {
    msgEl.className='avis-msg success';
    msgEl.textContent='✅ Merci pour vos avis ! Ils seront affichés après validation. 😊';
    // Masquer le bouton envoyer
    var btn = document.querySelector('.avis-submit-btn');
    if(btn) btn.style.display = 'none';
    // Marquer la commande comme soumise pour expirer le lien
    try {
      await fetch(API_URL, {
        method:'POST', redirect:'follow',
        headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'marquer_avis_soumis',  num:numCommande})
      });
    } catch(e) {}
  }
}
// ===== SUIVI AVEC TOKEN =====
async function ouvrirSuiviAvecToken(numCommande, trackToken) {
  // Activer la page suivi sans passer par showPage() pour ne pas ecraser le hash
  document.querySelectorAll(".page").forEach(function(el){el.classList.remove("active");});
  document.querySelectorAll(".nav-links button").forEach(function(b){b.classList.remove("active");});
  var pageSuivi = document.getElementById("page-suivi");
  if(pageSuivi) pageSuivi.classList.add("active");
  var navSuivi = document.getElementById("nav-suivi");
  if(navSuivi) navSuivi.classList.add("active");
  window.scrollTo(0,0);
  var result = document.getElementById("suivi-result");
  if(!result) return;
  var form = document.querySelector(".suivi-form");
  if(form) form.style.display = "none";
  result.innerHTML = "<div class=\"suivi-loading\">⏳ Chargement de votre suivi...</div>";
  try {
    var url = API_URL+'?action=suivi&commande='+encodeURIComponent(numCommande)+'&track_token='+encodeURIComponent(trackToken);
    var res = await fetch(url, {redirect:'follow'});
    var data = JSON.parse(await res.text());
    if(!data.success) {
      result.innerHTML = '<div class="suivi-error">❌ '+data.error+'</div>';
      return;
    }
    // Pré-remplir les champs du formulaire suivi
    var inputNum = document.getElementById('suivi-input');
    if(inputNum) inputNum.value = numCommande;
    // Déclencher l'affichage du résultat directement
    afficherResultatSuivi(data.commande);
  } catch(e) {
    result.innerHTML = '<div class="suivi-error">❌ Erreur de chargement. Veuillez réessayer.</div>';
  }
}
function afficherResultatSuivi(c) {
  var result = document.getElementById('suivi-result');
  if(!result || !c) return;
  var statut = c.statut || 'En attente';
  var STATUTS = ['En attente','Confirmé','Expédié','Livré','Annulé'];
  var STATUT_ICONS = {'En attente':'⏳','Confirmé':'✅','Expédié':'🚚','Livré':'🎉','Annulé':'❌'};
  var STATUT_CLASS = {'En attente':'statut-attente','Confirmé':'statut-confirme','Expédié':'statut-expedie','Livré':'statut-livre','Annulé':'statut-annule'};
  var stepsHtml = STATUTS.filter(function(s){return s!=='Annulé';}).map(function(s){
    var isDone = STATUTS.indexOf(statut) > STATUTS.indexOf(s) && statut !== 'Annulé';
    var isActive = s === statut;
    var cls = isDone?'done':isActive?'active':'';
    return '<div class="suivi-step"><div class="step-dot '+(isDone?'done':isActive?'active':'')+'">'+
      (isDone?'✓':(STATUT_ICONS[s]||'○'))+'</div>'+
      '<div class="step-info"><div class="step-label '+cls+'">'+s+'</div></div></div>';
  }).join('');
  var raisonHtml = c.raison && statut==='Annulé'
    ? '<div class="suivi-raison">❌ Motif : '+c.raison+'</div>' : '';
  var dateLivraisonHtml = statut !== 'Annulé' && statut !== 'Livré'
    ? '<div class="suivi-livraison">🚚 Livraison estimée : <strong>'+(c.date_livraison||'En cours de planification...')+'</strong></div>'
    : '';
  var historiqueParsed = c.historique
    ? c.historique.split(' | ').map(function(h){ return '<div class="hist-item">'+h+'</div>'; }).join('')
    : '';
  var historiqueHtml = historiqueParsed
    ? '<div class="suivi-historique"><div class="hist-title">📋 Historique</div>'+historiqueParsed+'</div>' : '';
  var items = c.produits ? c.produits.split(' | ') : [];
  var itemsHtml = items.map(function(item){
    var match = item.match(/^(.+?)\s*x(\d+)\s*=\s*(.+)$/);
    if(!match) return '<div class="suivi-item"><span class="suivi-item-nom">'+item+'</span></div>';
    var nomComplet = match[1].trim();
    var qty = match[2].trim();
    var prix = match[3].trim();
    var nomMatch = nomComplet.match(/^(.+?)\s*\((.+)\)$/);
    var nom = nomMatch ? nomMatch[1].trim() : nomComplet;
    var option = nomMatch ? nomMatch[2].trim() : '';
    return '<div class="suivi-item">'+'<div class="suivi-item-nom">'+nom+'</div>'+(option ? '<div class="suivi-item-option">📌 '+option+'</div>' : '')+'<div class="suivi-item-prix">'+qty+' × '+prix+'</div>'+'</div>';
  }).join('');
  var totalHtml = c.total ? '<div class="suivi-total">Total : <strong>'+Number(c.total).toLocaleString('fr-MG')+' Ar</strong></div>' : '';
  var adresseHtml = c.adresse ? '<div class="suivi-adresse">📍 '+c.adresse+'</div>' : '';
  var resumeHtml = itemsHtml ? '<div class="suivi-resume"><div class="suivi-resume-title">🛍️ Détail de la commande</div>'+itemsHtml+totalHtml+adresseHtml+'</div>' : '';
  result.innerHTML = '<div class="suivi-card">'+
    '<div class="suivi-num">Commande '+c.num+' — '+c.date+'</div>'+
    '<div class="suivi-statut '+(STATUT_CLASS[statut]||'statut-attente')+'">'+(STATUT_ICONS[statut]||'⏳')+' '+statut+'</div>'+
    raisonHtml+dateLivraisonHtml+
    '<div class="suivi-steps">'+stepsHtml+'</div>'+
    historiqueHtml+resumeHtml+
    '</div>';
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
  } else if(hash.startsWith('suivi-') && hash.split('-').length >= 3){
    // Lien unique de suivi : #suivi-CMD-XXXXXX-TOKEN
    var parts = hash.split('-');
    // Format: suivi-CMD-XXXXXX-TOKEN
    var cmdNum = parts[0]+'-'+parts[1]+'-'+parts[2]; // suivi-CMD-XXXXXX → CMD-XXXXXX
    var trackToken = parts.slice(3).join('-');
    ouvrirSuiviAvecToken(parts[1]+'-'+parts[2], trackToken);
  } else if(hash==='favoris'){
    showPage('favoris');
  } else if(hash==='cart'){
    showPage('cart');
  } else if(hash.startsWith('avis-')){
    var numCmd = hash.replace('avis-','');
    ouvrirFormulaireAvis(numCmd);
  } else if(hash.startsWith('product-')){
    var id=hash.replace('product-','');
    var p=products.find(function(p){return p.id==id || p.slug==id;});
    if(p) openProduct(p.id);
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
// ===== GESTION MAINTENANCE =====
function showMaintenance() {
  // Cacher toutes les pages et la nav
  document.querySelectorAll('.page').forEach(function(el){ el.style.display='none'; });
  var nav = document.querySelector('nav');
  if(nav) nav.style.display='none';
  var footer = document.querySelector('footer');
  if(footer) footer.style.display='none';
  var notif = document.querySelector('.notif-sticky');
  if(notif) notif.style.display='none';
  var backTop = document.getElementById('back-to-top');
  if(backTop) backTop.style.display='none';
  var cookie = document.getElementById('cookie-banner');
  if(cookie) cookie.style.display='none';
  // Afficher la page maintenance
  var dureeHtml = MAINTENANCE_DUREE
    ? '<p class="maint-duree">⏱️ Durée estimée : <strong>'+MAINTENANCE_DUREE+'</strong></p>'
    : '';
  var maint = document.getElementById('page-maintenance');
  if(maint){
    maint.style.display='flex';
    maint.innerHTML =
      '<div class="maint-box">'+
        '<div class="maint-icon">🔧</div>'+
        '<h2 class="maint-title">Site en maintenance</h2>'+
        '<p class="maint-msg">'+MAINTENANCE_MSG+'</p>'+
        '<p class="maint-soon">Nous serons de retour très bientôt !</p>'+
        dureeHtml+
        '<div class="maint-sep"></div>'+
        '<p class="maint-contact">Besoin d\'aide ?</p>'+
        '<div class="maint-btns">'+
          '<a class="maint-wa" href="https://wa.me/261346158199" target="_blank">'+
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'+
            ' Nous contacter sur WhatsApp'+
          '</a>'+
          '<a class="maint-fb" href="https://www.facebook.com/harvelstore" target="_blank">'+
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>'+
            ' Notre page Facebook'+
          '</a>'+
        '</div>'+
        '<p class="maint-footer">© 2026 Harvel Store 🛍️</p>'+
      '</div>';
  }
}
if(MAINTENANCE){
  // Mode maintenance — on n'initialise rien d'autre
  document.addEventListener('DOMContentLoaded', showMaintenance);
} else {
  loadProducts().then(function(){
    initFromHash();
  });
}