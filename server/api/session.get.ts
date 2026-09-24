import { getSessionState } from '../services/accounts'

export default defineEventHandler(event => getSessionState(event))
