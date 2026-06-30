// supabase-client.js — clé "anon" uniquement (sûr même en repo public)
// Utilisé par le SITE PUBLIC harvel-store.com (produits, avis, recommandations, codes promo)
// Les opérations ADMIN sensibles passent désormais par harvel-proxy.js (service_role protégée côté serveur)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/+esm'

const SUPABASE_URL = 'https://rcikcebyewurgjhnqeto.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWtjZWJ5ZXd1cmdqaG5xZXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTkxNTMsImV4cCI6MjA5NTg5NTE1M30.niZWrq2AOY6xRjI9Do-wfgmKDqVIr1GazDEW3cgq7Po'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)