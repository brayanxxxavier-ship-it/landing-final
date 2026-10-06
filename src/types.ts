export type Language = 'es' | 'en';
export type Theme = 'dark' | 'light';

export interface Vehicle {
  id: string;
  internal_code: string;
  name: string;
  description: string;
  description_en?: string;
  image_url: string;
  price_cop: number;
  price_usd: number;
  status: 'available' | 'reserved' | 'sold';
  display_order: number;
  is_public: boolean;
}

export interface PreorderFormData {
  fullName: string;
  email: string;
  phone: string;
  age: number | string;
  documentType: string;
  documentNumber: string;
  message: string;
  termsAccepted: boolean;
}

export interface PqrsFormData {
  requestType: 'petition' | 'complaint' | 'claim' | 'suggestion' | '';
  fullName: string;
  email: string;
  phone: string;
  documentType: string;
  documentNumber: string;
  subject: string;
  message: string;
  termsAccepted: boolean;
}
