import { Router } from 'express'
import {
  getSkillsVocabHandler,
  getRolesVocabHandler,
  getCitiesVocabHandler,
} from '../controllers/vocabController'

export const vocabRouter = Router()

// Public, cached endpoints with limit
vocabRouter.get('/skills', getSkillsVocabHandler)
vocabRouter.get('/roles',  getRolesVocabHandler)
vocabRouter.get('/cities', getCitiesVocabHandler)
