import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../db/supabase'
import { requireAuth } from '../middleware/authMiddleware'

export const talentAlertsRouter = Router()

/** GET /talent-alerts?user_id= */
talentAlertsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user_id = req.query.user_id as string
    if (!user_id) { res.status(400).json({ error: 'user_id required' }); return }
    const { data, error } = await supabase.from('talent_alerts').select('*').eq('user_id', user_id).order('created_at', { ascending: false })
    if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
    res.json({ alerts: data ?? [] })
  } catch (err) { next(err) }
})

/** POST /talent-alerts { user_id, label, skills?, role?, location?, language? } */
talentAlertsRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user_id, label, skills, role, location, language } = req.body as {
      user_id: string; label: string; skills?: string[]; role?: string; location?: string; language?: string
    }
    if (!user_id || !label) { res.status(400).json({ error: 'user_id and label required' }); return }
    const { data, error } = await supabase.from('talent_alerts')
      .insert({ user_id, label, skills: skills ?? [], role: role ?? null, location: location ?? null, language: language ?? null })
      .select().single()
    if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
    res.status(201).json({ alert: data })
  } catch (err) { next(err) }
})

/** DELETE /talent-alerts/:id */
talentAlertsRouter.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('talent_alerts').delete().eq('id', id)
    if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
    res.json({ ok: true })
  } catch (err) { next(err) }
})
