export interface LoginState {
  error: string | null
  busy: boolean
}

export type LoginStateAction =
  | { type: 'EDIT' | 'SUBMIT' | 'FINISH' }
  | { type: 'FAIL'; message: string }

export const INITIAL_LOGIN_STATE: LoginState = { error: null, busy: false }

export function loginStateReducer(state: LoginState, action: LoginStateAction): LoginState {
  if (action.type === 'EDIT') return state.error === null ? state : { ...state, error: null }
  if (action.type === 'SUBMIT') return { error: null, busy: true }
  if (action.type === 'FAIL') return { error: action.message, busy: false }
  return state.busy ? { ...state, busy: false } : state
}
