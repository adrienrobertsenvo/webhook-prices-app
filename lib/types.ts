export interface StoredSubscription {
  subscription_id: string;
  target_url: string;
  object_type: string;
  event_type: string;
  is_active: boolean;
  signing_secret?: string;
  created_at: string;
}

export interface StoredEvent {
  webhook_event_id: string;       // whe_*
  selling_price_id: string;       // slp_*
  charge_id: string;              // chg_*
  closed_book_rate_id: string | null;
  net_amount: number;
  currency: string;
  charge_reference_date: string;  // YYYY-MM-DD
  tenant_slug: string;
  event_type: 'created' | 'updated' | 'deleted';
  received_at: string;            // ISO timestamp
}
