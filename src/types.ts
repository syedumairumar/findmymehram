export type Tier = "free" | "gold" | "diamond";
export interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  profession: string;
  bio: string;
  interests: string[];
  languages: string[];
  intention: string;
  photo: string;
  photoPath?: string;
  gender: string;
}
export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}
export interface Match {
  id: string;
  profile: Profile;
  last_message?: string;
  unread: number;
}
export interface Membership {
  tier: Tier;
  source: string;
  expires_at: string | null;
}
export interface AdminData {
  total: number;
  active: number;
  reports: number;
  premium: number;
  users: Array<Profile & { status: string; tier: Tier; joined: string }>;
  daily: Array<{ day: string; signups: number; active: number }>;
  payments: Array<{
    id: string;
    provider: string;
    tier: string;
    amount: number;
    status: string;
    environment: string;
    created_at: string;
  }>;
  report_rows: Array<{
    id: string;
    reason: string;
    status: string;
    created_at: string;
    target_id: string;
  }>;
}
