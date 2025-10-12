import { createClient } from '@supabase/supabase-js'

// These will need to be configured in your Supabase project
// For now, using placeholder values - you'll need to replace these with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface HighScore {
  id?: number
  name: string
  score: number
  created_at?: string
}

// Create high scores table if it doesn't exist
export const createHighScoresTable = async () => {
  const { error } = await supabase.rpc('create_high_scores_table_if_not_exists')
  if (error) {
    console.log('High scores table might already exist or there was an error:', error.message)
  }
}

// Fetch top 3 high scores
export const getTopScores = async (): Promise<HighScore[]> => {
  const { data, error } = await supabase
    .from('high_scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(3)

  if (error) {
    console.error('Error fetching high scores:', error.message)
    // Fallback to localStorage if Supabase fails
    const saved = localStorage.getItem('pikachu-top-scores')
    return saved ? JSON.parse(saved) : []
  }

  return data || []
}

// Add a new high score
export const addHighScore = async (name: string, score: number): Promise<boolean> => {
  const { error } = await supabase
    .from('high_scores')
    .insert([{ name: name.slice(0, 10).toUpperCase(), score }])

  if (error) {
    console.error('Error adding high score:', error.message)
    // Fallback to localStorage if Supabase fails
    const saved = localStorage.getItem('pikachu-top-scores')
    const localScores = saved ? JSON.parse(saved) : []
    const newTopScores = [...localScores, { name: name.slice(0, 10).toUpperCase(), score }]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
    localStorage.setItem('pikachu-top-scores', JSON.stringify(newTopScores))
    return false
  }

  return true
}

// Clear all high scores (admin function)
export const clearHighScores = async (): Promise<boolean> => {
  const { error } = await supabase
    .from('high_scores')
    .delete()
    .neq('id', 0) // Delete all records

  if (error) {
    console.error('Error clearing high scores:', error.message)
    localStorage.setItem('pikachu-top-scores', '[]')
    return false
  }

  return true
}
