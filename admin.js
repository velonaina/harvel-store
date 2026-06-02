import { supabase } from './supabase-client.js'

// Redirige vers login si pas connecté
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.location.href = '/admin.html'
    return null
  }
  return session
}

// Login
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, message: error.message }
  return { success: true, session: data.session }
}

// Logout
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = '/admin.html'
}

// Récupère l'utilisateur connecté
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}