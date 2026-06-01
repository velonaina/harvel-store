import { supabase } from './supabase-client.js'

/**
 * Charge tous les produits actifs + leurs images principales.
 * Equivalent de l'appel Apps Script vers Google Sheets.
 */
export async function getProduitsActifs() {
  const { data, error } = await supabase
    .from('produits')
    .select(`
      id, nom, description, prix, prix_barre,
      stock, categorie, sous_categorie, badge,
      tailles, couleurs, options, prix_degressif,
      produit_images ( url, type, ordre )
    `)
    .eq('actif', true)
    .eq('valide_admin', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase getProduits error:', error)
    return []
  }

  // Normalise : ajoute image_url principale (compatible avec le code existant)
  return data.map(p => ({
    ...p,
    image_url: p.produit_images
      ?.find(img => img.type === 'principale')?.url
      ?? p.produit_images?.[0]?.url
      ?? null
  }))
}

/**
 * Charge un seul produit par ID avec toutes ses images.
 */
export async function getProduitById(id) {
  const { data, error } = await supabase
    .from('produits')
    .select(`*, produit_images ( url, type, ordre )`)
    .eq('id', id)
    .single()

  if (error) { console.error('getProduitById error:', error); return null }
  return data
}
