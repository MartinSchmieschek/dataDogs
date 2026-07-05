export interface IUser {
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}

export interface IAuthState {
  authenticated: boolean;
  user?: IUser;
}

export interface ICollaborators {
  entity_type: 'kennel' | 'node';
  id: string;
  visibility: 'public' | 'private';
  owner: IUser | null;
  editors: IUser[];
  viewers: IUser[];
  is_community: boolean;
}

export type AclRole = 'editor' | 'viewer' | 'owner';
