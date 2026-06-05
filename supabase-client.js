// supabase-client.js — NE PAS commiter sur GitHub (ajouter au .gitignore)

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL  = 'https://rcikcebyewurgjhnqeto.supabase.co'
const SUPABASE_KEY  = 'sb_publishable_ilhLps3XVOPb3K_-XkGGwA_Fi629Lv2'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)