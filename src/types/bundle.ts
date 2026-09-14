export interface Bundle {
  id: string;
  name: string;
  description?: string;
  promptIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type BundleCreate = {
  name: string;
  description?: string;
  promptIds?: string[];
};

export type BundleUpdate = {
  name?: string;
  description?: string;
  promptIds?: string[];
};
