import { Router } from 'express'
import {
  getUnsubscribeInfo,
  executeUnsubscribe,
} from '../controllers/unsubscribeController'

export const unsubscribeRouter = Router()

// Public unauthenticated endpoints
unsubscribeRouter.get('/:token', getUnsubscribeInfo)
unsubscribeRouter.post('/:token', executeUnsubscribe)
