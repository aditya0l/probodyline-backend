import { AsyncLocalStorage } from 'async_hooks';

export interface UserContext {
  id: string;
  role: string;
  email: string;
}

export const userContext = new AsyncLocalStorage<UserContext>();
