import type { Profile, Match, ChatMessage, Tier } from "../types";

export const DEMO_ID = "demo-me";
export const portraits = {
  zara: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
  aisha:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  meera:
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
  sana: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&q=80",
  omar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
  arjun:
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
};
export const demoProfiles: Profile[] = [
  {
    id: "demo-zara",
    name: "Zara",
    age: 27,
    city: "London, UK",
    profession: "Architect",
    bio: "Old-city walks, new recipes, and a very strong opinion on the perfect cup of chai. Looking for someone to build a little everyday magic with.",
    interests: ["Architecture", "Chai & conversation", "Weekend escapes"],
    languages: ["English", "Urdu"],
    intention: "A serious relationship",
    photo: portraits.zara,
    gender: "woman",
  },
  {
    id: "demo-aisha",
    name: "Aisha",
    age: 26,
    city: "Manchester, UK",
    profession: "Doctor",
    bio: "A book in my bag and a trip in the planning. Equally happy at a family dinner or getting lost in a new city. Kindness is my favourite quality.",
    interests: ["Books", "Travel", "Good food"],
    languages: ["English", "Punjabi"],
    intention: "Marriage-minded",
    photo: portraits.aisha,
    gender: "woman",
  },
  {
    id: "demo-meera",
    name: "Meera",
    age: 28,
    city: "Birmingham, UK",
    profession: "Product designer",
    bio: "Finding beauty in the small things. Sunday markets, a playlist for every mood, and spontaneous plans that turn into the best memories.",
    interests: ["Design", "Music", "Sunday markets"],
    languages: ["English", "Hindi"],
    intention: "A serious relationship",
    photo: portraits.meera,
    gender: "woman",
  },
  {
    id: "demo-sana",
    name: "Sana",
    age: 25,
    city: "Bristol, UK",
    profession: "Researcher",
    bio: "Curious about most things, especially people. I bake when it rains and hike when it doesn’t. Let’s start with a conversation.",
    interests: ["Hiking", "Baking", "Science"],
    languages: ["English", "Urdu"],
    intention: "Marriage-minded",
    photo: portraits.sana,
    gender: "woman",
  },
  {
    id: "demo-arjun",
    name: "Arjun",
    age: 29,
    city: "Edinburgh, UK",
    profession: "Software engineer",
    bio: "An optimist with a camera and an ever-growing list of places to explore. Looking for a teammate for the big adventures and the quiet days.",
    interests: ["Photography", "Cooking", "Outdoors"],
    languages: ["English", "Hindi"],
    intention: "A serious relationship",
    photo: portraits.arjun,
    gender: "man",
  },
];
export const demoMe: Profile = {
  id: DEMO_ID,
  name: "Omar",
  age: 29,
  city: "London, UK",
  profession: "Entrepreneur",
  bio: "Here for a thoughtful connection and a story worth starting.",
  interests: ["Travel", "Cooking", "Photography"],
  languages: ["English", "Urdu"],
  intention: "A serious relationship",
  photo: portraits.omar,
  gender: "man",
};
export interface DemoState {
  profile: Profile;
  tier: Tier;
  swipes: Record<string, boolean>;
  blocked: string[];
  matches: Match[];
  messages: ChatMessage[];
  reports: Array<{ target: string; reason: string }>;
}
export function initialDemo(): DemoState {
  return {
    profile: demoMe,
    tier: "free",
    swipes: {},
    blocked: [],
    matches: [
      {
        id: "demo-match-aisha",
        profile: demoProfiles[1],
        unread: 1,
        last_message: "What’s your go-to order at a chai spot?",
      },
    ],
    messages: [
      {
        id: "demo-message-1",
        match_id: "demo-match-aisha",
        sender_id: "demo-aisha",
        content:
          "Hey Omar! Your travel photos caught my eye. What’s your go-to order at a chai spot?",
        created_at: new Date().toISOString(),
      },
    ],
    reports: [],
  };
}
export const incomingDemo = ["demo-zara", "demo-meera", "demo-sana"];
