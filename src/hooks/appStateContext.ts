import { createContext } from 'react';
import type { AppState } from '../types/appState';

export const AppStateContext = createContext<AppState | null>(null);