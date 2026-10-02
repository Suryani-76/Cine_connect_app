import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase } from '../db/supabase'
import { requireAuth } from '../middleware/authMiddleware'
import { loadCallerContext, requireRole } from '../middleware/callerContext'

export const talentAlertsRouter = Router()

const createAlertSchema = z.object({
  label:    z.string().min(1).max(100),
  skills:   z.array(z.string().min(1)).max(20).optional(),
  role:     z.string().max(100).optional(),
  location: z.string().max(120).optional(),
  language: z.string().max(60).optional(),
})

// All identity from req.caller.userId — never from query/body

talentAlertsRouter.get('/',
  requireAuth, loadCallerContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabase
        .from('talent_alerts').select('*')
        .eq('user_id', req.caller!.userId)
        .order('created_at', { ascending: false })
      if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
      res.json({ alerts: data ?? [] })
    } catch (err) { next(err) }
  })

talentAlertsRouter.post('/',
  requireAuth, loadCallerContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createAlertSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message }); return
      }
      const { data, error } = await supabase.from('talent_alerts')
        .insert({
          user_id:  req.caller!.userId,  // from JWT — never body
          label:    parsed.data.label,
          skills:   parsed.data.skills   ?? [],
          role:     parsed.data.role     ?? null,
          location: parsed.data.location ?? null,
          language: parsed.data.language ?? null,
        })
        .select().single()
      if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
      res.status(201).json({ alert: data })
    } catch (err) { next(err) }
  })

talentAlertsRouter.delete('/:id',
  requireAuth, loadCallerContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      // Ownership check — only delete own alerts
      const { data: existing } = await supabase
        .from('talent_alerts').select('user_id').eq('id', id).single()
      if (!existing || existing.user_id !== req.caller!.userId) {
        res.status(404).json({ error: 'Alert not found' }); return
      }
      const { error } = await supabase.from('talent_alerts').delete().eq('id', id)
      if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
      res.json({ ok: true })
    } catch (err) { next(err) }
  })
