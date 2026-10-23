import { createClient } from '@supabase/supabase-js'

// 與照行 app 共用同一個 Supabase 專案。
// anon 公開金鑰本來就設計給前端用，真正權限由資料庫 RLS 控制（非 service_role）。
const SUPABASE_URL = 'https://fdnflasdjcnqldtyqkha.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkbmZsYXNkamNucWxkdHlxa2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjY4NjUsImV4cCI6MjA5OTUwMjg2NX0.NnVQ75pW5uYkoOwg365PILiAU7HfJCovukoBO9XNl-c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
