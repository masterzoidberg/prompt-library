import { useContext } from 'react';
import { LibraryDataContext } from './libraryDataContext';

export function useLibraryData() {
  const ctx = useContext(LibraryDataContext);
  if (!ctx) throw new Error('useLibraryData must be used within LibraryDataProvider');
  return ctx;
}