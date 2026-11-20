export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Catalogs
export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
}

export interface CatalogsSummary {
  branches: BranchOption[];
  fuel_types: CatalogItem[];
  vehicle_types: CatalogItem[];
  groups: CatalogItem[];
  routes: CatalogItem[];
}

// Vehicle
export interface VehicleListItem {
  id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  plate: string;
  vehicle_type_id?: string;
  vehicle_type_name?: string;
  fuel_type_id: string;
  fuel_type_name: string;
  route_id?: string;
  route_name?: string;
  tank_capacity_ml?: number;
  tank_capacity_liters?: number;
  status: 'active' | 'banned';
  note?: string;
  card_number?: string;
  group_ids: string[];
  group_names: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CredentialItem {
  id: string;
  method: 'card' | 'face' | 'fingerprint';
  external_id: string;
  status: 'active' | 'revoked';
  face_file_id?: string;
  biometric_template_id?: string;
  version: number;
  created_at: string;
  revoked_at?: string;
}

export interface VehicleDetail extends VehicleListItem {
  card_credential?: CredentialItem;
}

export interface CreateVehicleInput {
  branch_id: string;
  code: string;
  plate: string;
  vehicle_type_id?: string;
  fuel_type_id: string;
  route_id?: string;
  tank_capacity_liters?: number;
  note?: string;
  card_number?: string;
  group_ids?: string[];
}

export interface UpdateVehicleInput {
  branch_id: string;
  plate: string;
  vehicle_type_id?: string;
  fuel_type_id: string;
  route_id?: string;
  tank_capacity_liters?: number;
  note?: string;
  group_ids?: string[];
}

export interface VehicleListParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch_id?: string;
  status?: string;
  vehicle_type_id?: string;
  fuel_type_id?: string;
  route_id?: string;
  group_id?: string;
}

// Driver
export interface DriverListItem {
  id: string;
  branch_id: string;
  branch_name: string;
  code: string;
  full_name: string;
  phone?: string;
  department?: string;
  position: 'driver' | 'guard' | 'operator';
  status: 'active' | 'blocked' | 'inactive';
  valid_from?: string;
  valid_to?: string;
  note?: string;
  card_number?: string;
  has_face: boolean;
  face_file_id?: string;
  has_fingerprint: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DriverDetail extends DriverListItem {
  credentials: CredentialItem[];
}

export interface CreateDriverInput {
  branch_id: string;
  code: string;
  full_name: string;
  phone?: string;
  department?: string;
  position: 'driver' | 'guard' | 'operator';
  status?: 'active' | 'blocked' | 'inactive';
  valid_from?: string;
  valid_to?: string;
  note?: string;
  card_number?: string;
}

export interface UpdateDriverInput {
  branch_id: string;
  full_name: string;
  phone?: string;
  department?: string;
  position: 'driver' | 'guard' | 'operator';
  valid_from?: string;
  valid_to?: string;
  note?: string;
}

export interface DriverListParams {
  page?: number;
  page_size?: number;
  q?: string;
  branch_id?: string;
  status?: string;
  position?: string;
  department?: string;
}
