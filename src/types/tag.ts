export interface Tag {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
}

export type TagCreate = { name: string };
export type TagUpdate = { name?: string };