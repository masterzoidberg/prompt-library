export interface Folder {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
}

export type FolderCreate = { name: string };
export type FolderUpdate = { name?: string };