"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Baby,
  Bike,
  Briefcase,
  Calendar,
  CheckSquare,
  Edit3,
  Flame,
  Gem,
  GraduationCap,
  Heart,
  Lock,
  Moon,
  Search,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Target,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import axiosInstance from "../../shared/AxiosInstance/AxiosInstance";

// Translations
const translations = {
  en: {
    // Hero
    heroBadge: "Savings Goals & Circles",
    heroTitle: "Save Toward What",
    heroTitleHighlight: "Truly Matters",
    heroDesc: "Join community savings circles for specific goals. Locked savings, AI-powered insights, and 12,000+ motivated members.",
    heroButton: "Join a Circle",
    heroButton2: "Create Custom Goal",
    
    // Filters
    filterAll: "All Goals",
    filterFamily: "Family",
    filterIslamic: "Islamic",
    filterEducation: "Education",
    filterTech: "Tech & Gadget",
    filterLifestyle: "Lifestyle",
    filterEmergency: "Emergency",
    filterBusiness: "Business",
    
    // Search
    searchPlaceholder: "Search goals...",
    
    // Sort
    sortDefault: "Default",
    sortProgressHigh: "Progress high to low",
    sortProgressLow: "Progress low to high",
    sortMembersHigh: "Members high to low",
    sortNewest: "Newest first",
    
    // Bulk
    bulkSelected: "selected",
    bulkDeposit: "Deposit",
    bulkPause: "Pause",
    bulkShare: "Share",
    bulkDelete: "Delete",
    bulkCancel: "Cancel",
    
    // Featured
    featuredBadge: "Featured Circle · Most Popular",
    featuredTitle: "Grand Wedding Fund 2026",
    featuredDesc: "Bangladesh's largest wedding savings circle. 850+ members saving together for the perfect wedding. Monthly deposits from ৳5,000 to ৳30,000.",
    featuredMembers: "Members",
    featuredTotalSaved: "Total Saved",
    featuredDuration: "Duration",
    featuredProgress: "Progress",
    featuredRemaining: "remaining",
    featuredSpotsLeft: "spots left",
    featuredButton: "Join This Circle",
    featuredButton2: "View Details",
    
    // Goals Section
    goalsTitle: "All Savings Goals",
    goalsShowing: "Showing {count} goals",
    goalsSelect: "Select",
    
    // Goal Card
    goalDetails: "Details",
    goalEdit: "Edit",
    goalShare: "Share",
    goalJoin: "Join {name} Circle →",
    goalMonthly: "Monthly",
    goalDuration: "Duration",
    goalMembers: "members",
    goalBadgeOpen: "Open",
    goalBadgeFilling: "Filling Fast",
    goalBadgePopular: "Most Popular",
    goalBadgeNew: "New",
    goalBadgeIslamic: "Islamic",
    
    // Custom Goal
    customTitle: "Don't see your goal?",
    customDesc: "Create a completely custom savings goal with your own target amount, timeline, and circle name.",
    customButton: "Create Custom Goal",
    
    // Challenges
    challengeBadge: "Community Challenges",
    challengeTitle: "Stay Motivated.",
    challengeTitleHighlight: "Win Badges.",
    challengeDesc: "Join community challenges to earn achievement badges, climb the leaderboard, and hit your goals faster.",
    challengeParticipants: "participants",
    challengeJoin: "Join Challenge",
    challengeJoined: "Joined!",
    
    // Join Modal
    joinTitle: "Join {name} Circle",
    joinDesc: "You need an active account to join this circle.",
    joinLocked: "Savings are locked until goal maturity. Early withdrawal requires admin approval. No interest, no profit guarantees.",
    joinButton: "Create Account to Join",
    joinButton2: "Already a member? Log In",
    
    // Create Modal
    createTitle: "Create Custom Goal",
    createDesc: "Define your own savings goal with a custom name, target, and timeline.",
    createName: "Goal Name",
    createNamePlaceholder: "e.g. My Dream Home",
    createTarget: "Target (৳)",
    createTargetPlaceholder: "e.g. 500000",
    createMonthly: "Monthly (৳)",
    createMonthlyPlaceholder: "e.g. 10000",
    createButton: "Create Account to Save →",
    
    // Tags
    tagActive: "Active",
    tagAnyAmount: "Any amount",
    tagSeasonal: "Seasonal",
    tagIslamicMode: "Islamic Mode",
    tagBeginnerFriendly: "Beginner Friendly",
  },
  bn: {
    // Hero
    heroBadge: "সঞ্চয় লক্ষ্য ও সার্কেল",
    heroTitle: "যা সত্যিই গুরুত্বপূর্ণ",
    heroTitleHighlight: "তার জন্য সঞ্চয় করুন",
    heroDesc: "নির্দিষ্ট লক্ষ্যের জন্য কমিউনিটি সঞ্চয় সার্কেলে যোগ দিন। লক করা সঞ্চয়, এআই-চালিত অন্তর্দৃষ্টি এবং ১২,০০০+ অনুপ্রাণিত সদস্য।",
    heroButton: "একটি সার্কেলে যোগ দিন",
    heroButton2: "কাস্টম লক্ষ্য তৈরি করুন",
    
    // Filters
    filterAll: "সব লক্ষ্য",
    filterFamily: "পরিবার",
    filterIslamic: "ইসলামিক",
    filterEducation: "শিক্ষা",
    filterTech: "টেক ও গ্যাজেট",
    filterLifestyle: "লাইফস্টাইল",
    filterEmergency: "জরুরি",
    filterBusiness: "ব্যবসা",
    
    // Search
    searchPlaceholder: "লক্ষ্য খুঁজুন...",
    
    // Sort
    sortDefault: "ডিফল্ট",
    sortProgressHigh: "অগ্রগতি বেশি থেকে কম",
    sortProgressLow: "অগ্রগতি কম থেকে বেশি",
    sortMembersHigh: "সদস্য বেশি থেকে কম",
    sortNewest: "নতুন প্রথম",
    
    // Bulk
    bulkSelected: "নির্বাচিত",
    bulkDeposit: "জমা",
    bulkPause: "বিরতি",
    bulkShare: "শেয়ার",
    bulkDelete: "মুছে ফেলুন",
    bulkCancel: "বাতিল",
    
    // Featured
    featuredBadge: "বৈশিষ্ট্যযুক্ত সার্কেল · সবচেয়ে জনপ্রিয়",
    featuredTitle: "গ্র্যান্ড ওয়েডিং ফান্ড ২০২৬",
    featuredDesc: "বাংলাদেশের সবচেয়ে বড় বিয়ে সঞ্চয় সার্কেল। ৮৫০+ সদস্য একসাথে নিখুঁত বিয়ের জন্য সঞ্চয় করছেন। মাসিক জমা ৳৫,০০০ থেকে ৳৩০,০০০।",
    featuredMembers: "সদস্য",
    featuredTotalSaved: "মোট সঞ্চয়",
    featuredDuration: "মেয়াদ",
    featuredProgress: "অগ্রগতি",
    featuredRemaining: "বাকি",
    featuredSpotsLeft: "স্পট বাকি",
    featuredButton: "এই সার্কেলে যোগ দিন",
    featuredButton2: "বিস্তারিত দেখুন",
    
    // Goals Section
    goalsTitle: "সব সঞ্চয় লক্ষ্য",
    goalsShowing: "{count}টি লক্ষ্য দেখানো হচ্ছে",
    goalsSelect: "নির্বাচন",
    
    // Goal Card
    goalDetails: "বিস্তারিত",
    goalEdit: "সম্পাদনা",
    goalShare: "শেয়ার",
    goalJoin: "{name} সার্কেলে যোগ দিন →",
    goalMonthly: "মাসিক",
    goalDuration: "মেয়াদ",
    goalMembers: "সদস্য",
    goalBadgeOpen: "খোলা",
    goalBadgeFilling: "দ্রুত পূর্ণ হচ্ছে",
    goalBadgePopular: "সবচেয়ে জনপ্রিয়",
    goalBadgeNew: "নতুন",
    goalBadgeIslamic: "ইসলামিক",
    
    // Custom Goal
    customTitle: "আপনার লক্ষ্য খুঁজে পাচ্ছেন না?",
    customDesc: "আপনার নিজস্ব টার্গেট পরিমাণ, সময়সীমা এবং সার্কেল নাম সহ একটি সম্পূর্ণ কাস্টম সঞ্চয় লক্ষ্য তৈরি করুন।",
    customButton: "কাস্টম লক্ষ্য তৈরি করুন",
    
    // Challenges
    challengeBadge: "কমিউনিটি চ্যালেঞ্জ",
    challengeTitle: "অনুপ্রাণিত থাকুন।",
    challengeTitleHighlight: "ব্যাজ জিতুন।",
    challengeDesc: "অর্জন ব্যাজ অর্জন করতে, লিডারবোর্ডে উঠতে এবং আপনার লক্ষ্য দ্রুত পূরণ করতে কমিউনিটি চ্যালেঞ্জে যোগ দিন।",
    challengeParticipants: "অংশগ্রহণকারী",
    challengeJoin: "চ্যালেঞ্জে যোগ দিন",
    challengeJoined: "যোগদান করা হয়েছে!",
    
    // Join Modal
    joinTitle: "{name} সার্কেলে যোগ দিন",
    joinDesc: "এই সার্কেলে যোগ দিতে আপনার একটি সক্রিয় অ্যাকাউন্ট প্রয়োজন।",
    joinLocked: "লক্ষ্য পরিপক্ক হওয়া পর্যন্ত সঞ্চয় লক করা থাকে। অকাল উত্তোলনের জন্য প্রশাসকের অনুমোদন প্রয়োজন। কোন সুদ, কোন মুনাফা গ্যারান্টি নেই।",
    joinButton: "যোগদানের জন্য অ্যাকাউন্ট তৈরি করুন",
    joinButton2: "ইতিমধ্যে সদস্য? লগইন করুন",
    
    // Create Modal
    createTitle: "কাস্টম লক্ষ্য তৈরি করুন",
    createDesc: "আপনার নিজস্ব সঞ্চয় লক্ষ্য একটি কাস্টম নাম, টার্গেট এবং সময়সীমা সহ সংজ্ঞায়িত করুন।",
    createName: "লক্ষ্যের নাম",
    createNamePlaceholder: "যেমন: আমার স্বপ্নের বাড়ি",
    createTarget: "লক্ষ্য (৳)",
    createTargetPlaceholder: "যেমন: ৫০০০০০",
    createMonthly: "মাসিক (৳)",
    createMonthlyPlaceholder: "যেমন: ১০০০০",
    createButton: "সঞ্চয় করতে অ্যাকাউন্ট তৈরি করুন →",
    
    // Tags
    tagActive: "সক্রিয়",
    tagAnyAmount: "যেকোনো পরিমাণ",
    tagSeasonal: "মৌসুমি",
    tagIslamicMode: "ইসলামিক মোড",
    tagBeginnerFriendly: "শিক্ষানবিস বান্ধব",
  }
};

// Filters with translations
const getFilters = (t) => [
  { id: "all", label: t('filterAll'), icon: Star },
  { id: "family", label: t('filterFamily'), icon: Users },
  { id: "islamic", label: t('filterIslamic'), icon: Moon },
  { id: "education", label: t('filterEducation'), icon: GraduationCap },
  { id: "tech", label: t('filterTech'), icon: Smartphone },
  { id: "lifestyle", label: t('filterLifestyle'), icon: Sparkles },
  { id: "emergency", label: t('filterEmergency'), icon: Shield },
  { id: "business", label: t('filterBusiness'), icon: Briefcase },
];

const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  return `৳${value.toLocaleString("en-BD")}`;
};

const getGoalIcon = (type = "") => {
  const normalized = type.toLowerCase();
  if (normalized.includes("hajj") || normalized.includes("umrah")) return Moon;
  if (normalized.includes("education")) return GraduationCap;
  if (normalized.includes("business")) return Briefcase;
  if (normalized.includes("emergency")) return Shield;
  if (normalized.includes("wedding")) return Heart;
  if (normalized.includes("gadget") || normalized.includes("device")) return Smartphone;
  if (normalized.includes("bike") || normalized.includes("car") || normalized.includes("vehicle")) return Bike;
  if (normalized.includes("child") || normalized.includes("kids")) return Baby;
  return Target;
};

const getGoalCategory = (goal) => {
  const text = `${goal.goalType || ""} ${goal.goalName || ""}`.toLowerCase();
  const categories = [];
  if (text.includes("hajj") || text.includes("umrah") || goal.islamicMode) categories.push("islamic");
  if (text.includes("education") || text.includes("school") || text.includes("university")) categories.push("education");
  if (text.includes("business")) categories.push("business");
  if (text.includes("emergency")) categories.push("emergency");
  if (text.includes("wedding") || text.includes("child") || text.includes("kids") || text.includes("family")) categories.push("family");
  if (text.includes("gadget") || text.includes("device") || text.includes("phone") || text.includes("laptop")) categories.push("tech");
  if (text.includes("travel") || text.includes("bike") || text.includes("car") || text.includes("home")) categories.push("lifestyle");
  return categories.length ? categories.join(" ") : "lifestyle";
};

const buildAvatars = (name = "S") => {
  const letters = String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase());
  const initials = letters.length ? letters : ["S"];
  return initials.map((letter, index) => [
    letter,
    index === 0
      ? "linear-gradient(135deg,#059669,#0891b2)"
      : "linear-gradient(135deg,#f59e0b,#f97316)",
  ]);
};

const normalizeGoal = (goal, t) => {
  const progress = Math.max(0, Math.min(Number(goal.progress) || 0, 100));
  return {
    id: goal._id || goal.id,
    source: "goal",
    name: goal.goalName || "Savings Goal",
    desc: goal.description || `${formatCurrency(goal.currentSaved)} saved toward ${formatCurrency(goal.targetAmount)}.`,
    category: getGoalCategory(goal),
    icon: getGoalIcon(goal.goalType || goal.goalName),
    glow: goal.islamicMode ? "#10b981" : "#059669",
    progressColor: "linear-gradient(90deg,#059669,#0891b2)",
    badge: goal.islamicMode ? t('goalBadgeIslamic') : t('goalBadgeOpen'),
    badgeType: "open",
    members: 1,
    memberText: goal.status || t('tagActive'),
    progress,
    monthly: formatCurrency(goal.monthlyDeposit),
    duration: `${goal.durationInMonths || Math.ceil((Number(goal.targetAmount) || 0) / (Number(goal.monthlyDeposit) || 1))} mo`,
    avatars: buildAvatars(goal.goalName),
    createdAt: goal.createdAt,
  };
};

const normalizeCircle = (circle, t) => {
  const members = Number(circle.members ?? circle.currentMembers) || 0;
  const maxMembers = Number(circle.maxMembers) || members || 1;
  const progress = Math.max(0, Math.min(Math.round((members / maxMembers) * 100), 100));
  return {
    id: circle._id || circle.id,
    source: "circle",
    name: circle.name || circle.circleName || "Public Circle",
    desc: circle.description || `${members}/${maxMembers} members saving together.`,
    category: circle.purpose || "lifestyle",
    icon: Users,
    glow: "#0891b2",
    progressColor: "linear-gradient(90deg,#0891b2,#059669)",
    badge: progress >= 80 ? t('goalBadgeFilling') : t('goalBadgeOpen'),
    badgeType: progress >= 80 ? "filling" : "open",
    members,
    memberText: `${members}/${maxMembers} ${t('goalMembers')}`,
    progress,
    monthly: formatCurrency(circle.minDeposit),
    duration: circle.totalPool || formatCurrency(circle.totalPoolValue),
    avatars: buildAvatars(circle.name || circle.circleName),
    createdAt: circle.createdAt,
  };
};

// Get goal translations
const getGoals = (t) => [
  {
    id: "wedding",
    name: "Wedding Fund",
    desc: "Save for your dream wedding. Join a circle or create a private goal with your partner.",
    category: "family lifestyle",
    icon: Gem,
    glow: "#f472b6",
    progressColor: "linear-gradient(90deg,#059669,#0891b2)",
    badge: t('goalBadgeOpen'),
    badgeType: "open",
    members: 3240,
    memberText: "3,236 more saving",
    progress: 68,
    monthly: "৳5k-৳30k",
    duration: "12-36 mo",
    avatars: [
      ["F", "linear-gradient(135deg,#f472b6,#ec4899)"],
      ["N", "linear-gradient(135deg,#059669,#0891b2)"],
      ["R", "linear-gradient(135deg,#f59e0b,#f97316)"],
      ["+", "linear-gradient(135deg,#8b5cf6,#6366f1)"],
    ],
  },
  {
    id: "hajj",
    name: "Hajj Fund",
    desc: "Perform Hajj with complete peace of mind. Riba-free savings circle with Islamic mode enabled.",
    category: "islamic",
    icon: Moon,
    glow: "#10b981",
    progressColor: "linear-gradient(90deg,#059669,#10b981)",
    badge: `${t('goalBadgeOpen')} · ${t('goalBadgeIslamic')}`,
    badgeType: "open",
    members: 1890,
    memberText: "1,887 saving for Hajj",
    progress: 42,
    monthly: "৳10k-৳20k",
    duration: "24-48 mo",
    avatars: [
      ["A", "linear-gradient(135deg,#059669,#0891b2)"],
      ["K", "linear-gradient(135deg,#f59e0b,#f97316)"],
      ["+", "linear-gradient(135deg,#8b5cf6,#6366f1)"],
    ],
  },
  {
    id: "emergency",
    name: "Emergency Fund",
    desc: "Build a 6-month financial safety net. The most important savings goal anyone can have.",
    category: "emergency",
    icon: Shield,
    glow: "#f59e0b",
    progressColor: "linear-gradient(90deg,#f59e0b,#f97316)",
    badge: t('goalBadgePopular'),
    badgeType: "open",
    members: 5610,
    memberText: "5,607 building safety nets",
    progress: 55,
    monthly: "৳500-৳5k",
    duration: "6-12 mo",
    avatars: [
      ["S", "linear-gradient(135deg,#f59e0b,#f97316)"],
      ["T", "linear-gradient(135deg,#059669,#0891b2)"],
      ["+", "linear-gradient(135deg,#ef4444,#f97316)"],
    ],
  },
  {
    id: "education",
    name: "Education Fund",
    desc: "Invest in your future. Save for university fees, professional courses, or children's education.",
    category: "education",
    icon: GraduationCap,
    glow: "#8b5cf6",
    progressColor: "linear-gradient(90deg,#8b5cf6,#6366f1)",
    badge: t('goalBadgeOpen'),
    badgeType: "open",
    members: 2140,
    memberText: "2,138 investing in education",
    progress: 38,
    monthly: "৳2k-৳15k",
    duration: "12-60 mo",
    avatars: [
      ["M", "linear-gradient(135deg,#8b5cf6,#6366f1)"],
      ["J", "linear-gradient(135deg,#3b82f6,#06b6d4)"],
    ],
  },
  {
    id: "gadget",
    name: "Gadget & Device Fund",
    desc: "Save for laptops, phones, or any tech gadget. Short-term, high-discipline savings.",
    category: "tech",
    icon: Smartphone,
    glow: "#3b82f6",
    progressColor: "linear-gradient(90deg,#3b82f6,#06b6d4)",
    badge: t('goalBadgeFilling'),
    badgeType: "filling",
    members: 4320,
    memberText: "4,318 saving for devices",
    progress: 74,
    monthly: "৳1k-৳10k",
    duration: "3-12 mo",
    avatars: [
      ["P", "linear-gradient(135deg,#3b82f6,#06b6d4)"],
      ["Q", "linear-gradient(135deg,#059669,#0891b2)"],
    ],
  },
  {
    id: "business",
    name: "Business Startup Fund",
    desc: "Build your capital to launch your business. For entrepreneurs and small business owners.",
    category: "business",
    icon: Briefcase,
    glow: "#06b6d4",
    progressColor: "linear-gradient(90deg,#06b6d4,#3b82f6)",
    badge: t('goalBadgeOpen'),
    badgeType: "open",
    members: 980,
    memberText: "978 building businesses",
    progress: 28,
    monthly: "৳5k-৳50k",
    duration: "12-48 mo",
    avatars: [
      ["B", "linear-gradient(135deg,#06b6d4,#3b82f6)"],
      ["C", "linear-gradient(135deg,#f59e0b,#f97316)"],
    ],
  },
  {
    id: "bike",
    name: "Bike / Vehicle Fund",
    desc: "Save for your dream bike or vehicle. Short to medium-term savings goal.",
    category: "lifestyle",
    icon: Bike,
    glow: "#f97316",
    progressColor: "linear-gradient(90deg,#f97316,#f59e0b)",
    badge: t('goalBadgeOpen'),
    badgeType: "open",
    members: 1620,
    memberText: "1,618 saving for rides",
    progress: 61,
    monthly: "৳2k-৳15k",
    duration: "6-24 mo",
    avatars: [
      ["D", "linear-gradient(135deg,#f97316,#f59e0b)"],
      ["E", "linear-gradient(135deg,#059669,#0891b2)"],
    ],
  },
  {
    id: "kids",
    name: "Kids Future Fund",
    desc: "Secure your child's future today. Education, career, marriage, start saving early.",
    category: "family education",
    icon: Baby,
    glow: "#a78bfa",
    progressColor: "linear-gradient(90deg,#a78bfa,#8b5cf6)",
    badge: t('goalBadgeNew'),
    badgeType: "open",
    members: 640,
    memberText: "639 saving for kids",
    progress: 18,
    monthly: "৳1k-৳20k",
    duration: "36-120 mo",
    avatars: [["L", "linear-gradient(135deg,#a78bfa,#8b5cf6)"]],
  },
  {
    id: "umrah",
    name: "Umrah Fund",
    desc: "Save for your Umrah journey. Halal, riba-free savings with Islamic mode fully enabled.",
    category: "islamic",
    icon: Star,
    glow: "#065f46",
    progressColor: "linear-gradient(90deg,#065f46,#059669)",
    badge: t('goalBadgeIslamic'),
    badgeType: "open",
    members: 720,
    memberText: "719 saving for Umrah",
    progress: 33,
    monthly: "৳3k-৳10k",
    duration: "12-24 mo",
    avatars: [["U", "linear-gradient(135deg,#065f46,#059669)"]],
  },
];

// Get challenges with translations
const getChallenges = (t) => [
  {
    id: "30-day",
    icon: Flame,
    title: "30-Day Savings Streak",
    desc: "Make a deposit every day for 30 consecutive days and earn the Streak Warrior badge.",
    tags: [
      [t('tagActive'), "green"],
      [t('tagAnyAmount'), "blue"],
    ],
    participants: "2,840 participants",
  },
  {
    id: "ramadan",
    icon: Moon,
    title: "Ramadan Savings Challenge",
    desc: "Save a little every day of Ramadan. Special seasonal badge + community milestone celebration.",
    tags: [
      [t('tagSeasonal'), "gold"],
      [t('tagIslamicMode'), "green"],
    ],
    participants: "1,240 participants",
  },
  {
    id: "100tk",
    icon: Target,
    title: "Daily ৳100 Challenge",
    desc: "Save just ৳100 every single day. Prove that small, consistent steps build big savings.",
    tags: [
      [t('tagBeginnerFriendly'), "blue"],
      [t('tagActive'), "green"],
    ],
    participants: "4,120 participants",
  },
];

const GoalsPage = () => {
  const [language, setLanguage] = useState('en');
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [joinModalOpen, setJoinModalOpen] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState(new Set());
  const [joinedChallenges, setJoinedChallenges] = useState(new Set());
  const [publicGoals, setPublicGoals] = useState([]);
  const [publicCircles, setPublicCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [joiningCircle, setJoiningCircle] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Get language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage') || 'en';
    setLanguage(savedLang);
    setIsLoggedIn(Boolean(localStorage.getItem("token")));
  }, []);

  // Translation function
  const t = (key) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  // Get dynamic data with translations
  const filters = getFilters(t);
  const goals = useMemo(
    () => [
      ...publicGoals.map((goal) => normalizeGoal(goal, t)),
      ...publicCircles.map((circle) => normalizeCircle(circle, t)),
    ],
    [publicGoals, publicCircles, language],
  );
  const featuredCircle = useMemo(
    () => publicCircles[0] ? normalizeCircle(publicCircles[0], t) : null,
    [publicCircles, language],
  );
  const publicCircleCards = useMemo(
    () => publicCircles.map((circle) => normalizeCircle(circle, t)),
    [publicCircles, language],
  );
  const challenges = useMemo(
    () =>
      publicCircleCards.map((circle) => ({
        id: circle.id,
        icon: circle.icon,
        title: circle.name,
        desc: circle.desc,
        tags: [
          [circle.badge, circle.badgeType === "filling" ? "gold" : "green"],
          [circle.monthly, "blue"],
        ],
        participants: circle.memberText,
      })),
    [publicCircleCards],
  );

  const filteredGoals = useMemo(() => {
    const filtered = goals
      .filter((goal) => activeFilter === "all" || goal.category.includes(activeFilter))
      .filter((goal) => goal.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return sortGoals(filtered, sortBy);
  }, [goals, activeFilter, searchQuery, sortBy]);

  const selectedGoal = goals.find((goal) => goal.id === joinModalOpen);

  const openJoinFlow = async (itemId) => {
    const item = goals.find((goal) => goal.id === itemId);
    const token = localStorage.getItem("token");
    setIsLoggedIn(Boolean(token));

    if (!token || item?.source !== "circle") {
      setJoinMessage("");
      setJoinModalOpen(itemId);
      return;
    }

    setJoiningCircle(true);
    try {
      const response = await axiosInstance.post(
        `/circles/${itemId}/join`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setJoinMessage(response.data?.message || "Successfully joined the circle");
      setJoinModalOpen(itemId);

      const circlesResponse = await axiosInstance.get("/circles/public", {
        params: { limit: 100 },
      });
      setPublicCircles(circlesResponse.data?.data?.circles || []);
    } catch (error) {
      setJoinMessage(error.response?.data?.message || "Failed to join circle");
      setJoinModalOpen(itemId);
    } finally {
      setJoiningCircle(false);
    }
  };

  const rememberCircleBeforeRegister = () => {
    if (selectedGoal?.source === "circle") {
      localStorage.setItem("pendingCircleId", selectedGoal.id);
      localStorage.setItem("pendingCircleName", selectedGoal.name);
    }
  };

  useEffect(() => {
    const fetchPublicData = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const [goalsResponse, circlesResponse] = await Promise.all([
          axiosInstance.get("/goals", { params: { limit: 100 } }),
          axiosInstance.get("/circles/public", { params: { limit: 100 } }),
        ]);

        setPublicGoals(goalsResponse.data?.data?.goals || []);
        setPublicCircles(circlesResponse.data?.data?.circles || []);
      } catch (error) {
        console.error("Fetch public goals/circles error:", error);
        setLoadError(error.response?.data?.message || "Failed to load public savings data");
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, []);

  const toggleGoalSelection = (id) => {
    setSelectedGoals((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedGoals((current) =>
      current.size === filteredGoals.length ? new Set() : new Set(filteredGoals.map((goal) => goal.id)),
    );
  };

  const closeBulkMode = () => {
    setBulkMode(false);
    setSelectedGoals(new Set());
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[#0f172a] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-[#05966933] border-t-[#059669]" />
          <p className="text-sm text-[#475569] dark:text-[#94a3b8]">Loading public goals and circles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Inter',sans-serif] text-[#0f172a] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]">
      {/* Hero Section */}
      <section className="bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)] px-6 py-[72px] pb-[52px] text-center dark:bg-[linear-gradient(135deg,#022c22,#0c1a3a)]">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-[#05966926] bg-[#05966914] px-3.5 py-1.5 text-xs font-semibold text-[#059669]">
            <Target className="h-3.5 w-3.5" />
            {t('heroBadge')}
          </div>
          <h1 className="mb-3 text-[clamp(28px,4.5vw,48px)] font-black leading-[1.15] tracking-[-.8px]">
            {t('heroTitle')}{" "}
            <span className="bg-[linear-gradient(135deg,#059669,#0891b2)] bg-clip-text text-transparent">
              {t('heroTitleHighlight')}
            </span>
          </h1>
          <p className="mx-auto mb-7 max-w-[560px] text-[17px] leading-[1.7] text-[#475569] dark:text-[#94a3b8]">
            {t('heroDesc')}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-[9px] bg-[linear-gradient(135deg,#059669,#0891b2)] px-6 py-3 text-sm font-semibold text-white shadow-[0_3px_10px_rgba(5,150,105,.25)]"
            >
              {t('heroButton')} <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-[9px] border border-[#e2e8f0] bg-transparent px-6 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-[#059669] hover:text-[#059669] dark:border-[#1e2d3d] dark:text-[#f1f5f9]"
            >
              <Sparkles className="h-4 w-4" />
              {t('heroButton2')}
            </button>
          </div>
        </div>
      </section>

      {/* Sticky Filter Bar */}
      <div className="sticky top-16 z-30 border-b border-[#e2e8f0] bg-white py-4 shadow-[0_2px_8px_rgba(0,0,0,.04)] dark:border-[#1e2d3d] dark:bg-[#1a2235]">
        <div className="mx-auto max-w-[1160px] px-6">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {filters.map((filter) => {
              const Icon = filter.icon;
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter.id);
                    setSelectedGoals(new Set());
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-semibold transition ${
                    active
                      ? "border-transparent bg-[linear-gradient(135deg,#059669,#0891b2)] text-white shadow-[0_3px_10px_rgba(5,150,105,.25)]"
                      : "border-[#e2e8f0] bg-white text-[#475569] hover:border-[#059669] hover:text-[#059669] dark:border-[#1e2d3d] dark:bg-[#1a2235] dark:text-[#94a3b8]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {filter.label}
                </button>
              );
            })}
            <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full border-[1.5px] border-[#e2e8f0] bg-white px-3.5 py-2 dark:border-[#1e2d3d] dark:bg-[#0a0f1e]">
              <Search className="h-3.5 w-3.5 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-32 bg-transparent text-[13px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] dark:text-[#f1f5f9]"
              />
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="shrink-0 rounded-full border-[1.5px] border-[#e2e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#0f172a] outline-none dark:border-[#1e2d3d] dark:bg-[#1a2235] dark:text-[#f1f5f9]"
            >
              <option value="default">{t('sortDefault')}</option>
              <option value="progress-desc">{t('sortProgressHigh')}</option>
              <option value="progress-asc">{t('sortProgressLow')}</option>
              <option value="members-desc">{t('sortMembersHigh')}</option>
              <option value="newest">{t('sortNewest')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Mode Bar */}
      {bulkMode && (
        <div className="sticky top-32 z-30 bg-[linear-gradient(135deg,#059669,#0891b2)] px-6 py-2.5">
          <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-white">
              <input
                type="checkbox"
                checked={selectedGoals.size === filteredGoals.length && filteredGoals.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 accent-white"
              />
              {selectedGoals.size} {t('bulkSelected')}
            </label>
            <div className="h-5 w-px bg-white/30" />
            {[
              [t('bulkDeposit'), Wallet],
              [t('bulkPause'), Lock],
              [t('bulkShare'), Share2],
              [t('bulkDelete'), Trash2],
            ].map(([label, Icon]) => (
              <button
                key={label}
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold text-white ${
                  label === t('bulkDelete')
                    ? "border-red-400/50 bg-red-500/30"
                    : "border-white/30 bg-white/20"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={closeBulkMode}
              className="ml-auto rounded-lg border border-white/20 bg-white/15 px-3.5 py-2 text-xs text-white"
            >
              {t('bulkCancel')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="px-6 py-10">
        <div className="mx-auto max-w-[1160px]">
          {loadError && (
            <div className="mb-6 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/30">
              {loadError}
            </div>
          )}

          {/* Featured Circle */}
          {featuredCircle && (
          <section className="relative mb-8 overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#059669,#0891b2)] p-7 text-white">
            <div className="absolute right-[-80px] top-[-80px] h-[300px] w-[300px] rounded-full bg-white/[.06]" />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-[14px] border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur">
                <Star className="h-3.5 w-3.5 fill-white" />
                {t('featuredBadge')}
              </div>
              <h2 className="mb-1.5 text-[22px] font-black">{featuredCircle.name}</h2>
              <p className="mb-4 max-w-[500px] text-sm leading-relaxed text-white/85">
                {featuredCircle.desc}
              </p>
              <div className="mb-5 flex flex-wrap gap-6">
                {[
                  [featuredCircle.members.toLocaleString(), t('featuredMembers')],
                  [featuredCircle.duration, t('featuredTotalSaved')],
                  [featuredCircle.monthly, t('goalMonthly')],
                  [`${featuredCircle.progress}%`, t('featuredProgress')],
                ].map(([value, label]) => (
                  <div key={label}>
                    <div className="text-xl font-extrabold">{value}</div>
                    <div className="mt-px text-[11px] text-white/75">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mb-2 h-2 rounded bg-white/20">
                <div className="h-full rounded bg-white" style={{ width: `${featuredCircle.progress}%` }} />
              </div>
              <p className="mb-4 text-xs text-white/75">
                {featuredCircle.memberText}
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => openJoinFlow(featuredCircle.id)}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-white px-5 py-2.5 text-[13px] font-bold text-[#059669] transition hover:-translate-y-px"
                >
                  {t('featuredButton')} <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => openJoinFlow(featuredCircle.id)}
                  className="rounded-[10px] border-[1.5px] border-white/30 bg-white/15 px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-white/25"
                >
                  {t('featuredButton2')}
                </button>
              </div>
            </div>
          </section>
          )}

          {/* Goals Grid */}
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-extrabold text-[#0f172a] dark:text-[#f1f5f9]">
                {t('goalsTitle')}
              </h2>
              <p className="text-[13px] text-[#94a3b8]">
                {t('goalsShowing').replace('{count}', filteredGoals.length)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#e2e8f0] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#475569] transition hover:border-[#059669] hover:text-[#059669] dark:border-[#1e2d3d] dark:text-[#94a3b8]"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {t('goalsSelect')}
            </button>
          </div>

          {/* Goal Cards - শুধু changes দেখাচ্ছি, GoalCard component টি আগের মতোই থাকবে */}
          {filteredGoals.length === 0 ? (
            <div className="mb-10 rounded-[20px] border border-[#e2e8f0] bg-white p-8 text-center text-sm font-semibold text-[#475569] dark:border-[#1e2d3d] dark:bg-[#1a2235] dark:text-[#94a3b8]">
              No public goals or circles found.
            </div>
          ) : (
            <div className="mb-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredGoals.map((goal) => (
                <GoalCard
                  key={`${goal.source}-${goal.id}`}
                  goal={goal}
                  bulkMode={bulkMode}
                  selected={selectedGoals.has(goal.id)}
                  onSelect={() => toggleGoalSelection(goal.id)}
                  onJoin={openJoinFlow}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Custom Goal CTA */}
          <section className="mt-4 rounded-[20px] border border-[#e2e8f0] bg-[#f8fafc] p-7 text-center dark:border-[#1e2d3d] dark:bg-[#111827]">
            <h3 className="mb-2 text-xl font-extrabold text-[#0f172a] dark:text-[#f1f5f9]">
              {t('customTitle')}
            </h3>
            <p className="mb-5 text-sm text-[#475569] dark:text-[#94a3b8]">
              {t('customDesc')}
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-[11px] bg-[linear-gradient(135deg,#059669,#0891b2)] px-7 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(5,150,105,.3)]"
            >
              <Sparkles className="h-4 w-4" />
              {t('customButton')}
            </button>
          </section>
        </div>
      </main>

      {/* Challenges Section - শুধু changes দেখাচ্ছি */}
      <section className="bg-[linear-gradient(135deg,#ecfdf5,#eff6ff)] px-6 py-14 text-center dark:bg-[linear-gradient(135deg,#022c22,#0c1a3a)]">
        <div className="mx-auto max-w-[1160px]">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#05966926] bg-[#05966914] px-3.5 py-1.5 text-xs font-semibold text-[#059669]">
            <Users className="h-3.5 w-3.5" />
            Public Circles
          </div>
          <h2 className="mb-2 text-[clamp(24px,3.5vw,36px)] font-black">
            Public Savings <span className="text-[#059669]">Circles</span>
          </h2>
          <p className="mx-auto max-w-[520px] text-[15px] text-[#475569] dark:text-[#94a3b8]">
            Browse active public circles. Private circles stay invite-only.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {challenges.map((challenge) => {
              const Icon = challenge.icon;
              const joined = joinedChallenges.has(challenge.id);
              return (
                <article
                  key={challenge.id}
                  className="rounded-2xl border border-[#e2e8f0] bg-white p-[22px] text-left transition hover:-translate-y-[3px] hover:border-[#059669] dark:border-[#1e2d3d] dark:bg-[#1a2235]"
                >
                  <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#05966914] text-[#059669]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mb-1.5 text-base font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                    {challenge.title}
                  </h3>
                  <p className="mb-3 text-[13px] leading-normal text-[#475569] dark:text-[#94a3b8]">
                    {challenge.desc}
                  </p>
                  <div className="mb-3.5 flex flex-wrap gap-2.5">
                    {challenge.tags.map(([label, type]) => (
                      <Tag key={label} type={type}>
                        {label}
                      </Tag>
                    ))}
                  </div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs text-[#94a3b8]">
                    <Users className="h-3.5 w-3.5" />
                    {challenge.participants}
                  </div>
                  <button
                    type="button"
                    onClick={() => openJoinFlow(challenge.id)}
                    className={`w-full rounded-[9px] border p-2.5 text-xs font-bold transition ${
                      joined
                        ? "border-transparent bg-[linear-gradient(135deg,#059669,#0891b2)] text-white"
                        : "border-[#05966933] bg-[#05966914] text-[#059669] hover:border-transparent hover:bg-[linear-gradient(135deg,#059669,#0891b2)] hover:text-white"
                    }`}
                  >
                    {t('featuredButton')}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Join Modal - শুধু changes দেখাচ্ছি */}
      {joinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setJoinModalOpen(null)}
        >
          <div
            className="relative w-full max-w-[480px] rounded-[20px] bg-white p-8 shadow-[0_40px_100px_rgba(0,0,0,.2)] dark:bg-[#1a2235]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setJoinModalOpen(null)}
              className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white dark:border-[#1e2d3d] dark:bg-[#0a0f1e]"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#05966914] text-[#059669]">
              {selectedGoal ? <selectedGoal.icon className="h-8 w-8" /> : <Target className="h-8 w-8" />}
            </div>
            <h3 className="mb-1.5 text-center text-xl font-black text-[#0f172a] dark:text-[#f1f5f9]">
              {t('joinTitle').replace('{name}', selectedGoal?.name || 'Savings')}
            </h3>
            <p className="mb-5 text-center text-[13px] text-[#475569] dark:text-[#94a3b8]">
              {joinMessage || t('joinDesc')}
            </p>
            <div className="mb-4 rounded-xl bg-[#f8fafc] p-4 text-[13px] leading-relaxed text-[#475569] dark:bg-[#111827] dark:text-[#94a3b8]">
              <Lock className="mr-1 inline h-3.5 w-3.5" />
              {t('joinLocked')}
            </div>
            <div className="flex flex-col gap-2.5">
              {isLoggedIn && selectedGoal?.source === "circle" ? (
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(null)}
                  className="rounded-[11px] bg-[linear-gradient(135deg,#059669,#0891b2)] p-[13px] text-center text-sm font-bold text-white shadow-[0_4px_14px_rgba(5,150,105,.3)]"
                >
                  Close
                </button>
              ) : (
                <>
                  <Link
                    href={selectedGoal?.source === "circle" ? `/register?circleId=${selectedGoal.id}` : "/register"}
                    onClick={rememberCircleBeforeRegister}
                    className="rounded-[11px] bg-[linear-gradient(135deg,#059669,#0891b2)] p-[13px] text-center text-sm font-bold text-white shadow-[0_4px_14px_rgba(5,150,105,.3)]"
                  >
                    {joiningCircle ? "Joining..." : t('joinButton')}
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-[11px] border-[1.5px] border-[#e2e8f0] bg-white p-3 text-center text-sm font-semibold text-[#0f172a] transition hover:border-[#059669] hover:text-[#059669] dark:border-[#1e2d3d] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]"
                  >
                    {t('joinButton2')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal - শুধু changes দেখাচ্ছি */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="relative w-full max-w-[520px] rounded-[20px] bg-white p-8 shadow-[0_40px_100px_rgba(0,0,0,.2)] dark:bg-[#1a2235]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e2e8f0] bg-white dark:border-[#1e2d3d] dark:bg-[#0a0f1e]"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-1.5 text-xl font-black text-[#0f172a] dark:text-[#f1f5f9]">
              {t('createTitle')}
            </h3>
            <p className="mb-5 text-[13px] text-[#475569] dark:text-[#94a3b8]">
              {t('createDesc')}
            </p>
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.4px] text-[#475569] dark:text-[#94a3b8]">
                  {t('createName')}
                </label>
                <input
                  type="text"
                  placeholder={t('createNamePlaceholder')}
                  className="w-full rounded-[10px] border-[1.5px] border-[#e2e8f0] bg-white px-3.5 py-3 text-sm text-[#0f172a] outline-none focus:border-[#059669] dark:border-[#1e2d3d] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]"
                />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.4px] text-[#475569] dark:text-[#94a3b8]">
                    {t('createTarget')}
                  </label>
                  <input
                    type="number"
                    placeholder={t('createTargetPlaceholder')}
                    className="w-full rounded-[10px] border-[1.5px] border-[#e2e8f0] bg-white px-3.5 py-3 text-sm text-[#0f172a] outline-none focus:border-[#059669] dark:border-[#1e2d3d] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.4px] text-[#475569] dark:text-[#94a3b8]">
                    {t('createMonthly')}
                  </label>
                  <input
                    type="number"
                    placeholder={t('createMonthlyPlaceholder')}
                    className="w-full rounded-[10px] border-[1.5px] border-[#e2e8f0] bg-white px-3.5 py-3 text-sm text-[#0f172a] outline-none focus:border-[#059669] dark:border-[#1e2d3d] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]"
                  />
                </div>
              </div>
            </div>
            <Link
              href="/register"
              className="block rounded-[11px] bg-[linear-gradient(135deg,#059669,#0891b2)] p-[13px] text-center text-sm font-bold text-white"
            >
              {t('createButton')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function
const sortGoals = (items, sortBy) => {
  const sorted = [...items];
  if (sortBy === "progress-desc") return sorted.sort((a, b) => b.progress - a.progress);
  if (sortBy === "progress-asc") return sorted.sort((a, b) => a.progress - b.progress);
  if (sortBy === "members-desc") return sorted.sort((a, b) => b.members - a.members);
  if (sortBy === "newest") return sorted.reverse();
  return sorted;
};

// Tag Component
function Tag({ type, children }) {
  const styles = {
    green: "bg-[#0596691a] text-[#059669]",
    blue: "bg-[#3b82f61a] text-[#3b82f6]",
    gold: "bg-[#f59e0b1a] text-[#d97706]",
  };

  return (
    <span className={`rounded-[7px] px-2 py-1 text-[11px] font-semibold ${styles[type]}`}>
      {children}
    </span>
  );
}

// GoalCard Component with translations
function GoalCard({ goal, bulkMode, selected, onSelect, onJoin, t }) {
  const Icon = goal.icon;

  return (
    <article
      onClick={bulkMode ? onSelect : undefined}
      className={`group relative cursor-pointer overflow-hidden rounded-[20px] border bg-white transition-all duration-200 hover:-translate-y-[5px] hover:border-transparent hover:shadow-[0_16px_48px_rgba(0,0,0,.10)] dark:bg-[#1a2235] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,.45)] ${
        selected ? "border-[#059669] ring-2 ring-[#059669]" : "border-[#e2e8f0] dark:border-[#1e2d3d]"
      }`}
    >
      {bulkMode && (
        <input
          type="checkbox"
          readOnly
          checked={selected}
          className="absolute left-3 top-3 z-10 h-[18px] w-[18px] accent-[#059669]"
        />
      )}
      <div className="relative px-5 pb-0 pt-5">
        <div
          className="absolute right-[-20px] top-[-20px] h-[100px] w-[100px] rounded-full opacity-[0.07] transition-all duration-300 group-hover:scale-125 group-hover:opacity-[0.14]"
          style={{ background: `radial-gradient(circle,${goal.glow},transparent)` }}
        />
        <div className="relative mb-2.5 flex items-start justify-between">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#f8fafc] text-[#059669] dark:bg-[#111827]">
            <Icon className="h-7 w-7" />
          </div>
          <span
            className={`rounded-lg px-[9px] py-[3px] text-[11px] font-semibold ${
              goal.badgeType === "filling"
                ? "bg-[#f59e0b1a] text-[#d97706]"
                : "bg-[#0596691a] text-[#059669]"
            }`}
          >
            {goal.badge}
          </span>
        </div>
        <h3 className="relative mb-1 text-lg font-extrabold text-[#0f172a] dark:text-[#f1f5f9]">
          {goal.name}
        </h3>
        <p className="relative mb-3 text-[13px] leading-normal text-[#475569] dark:text-[#94a3b8]">
          {goal.desc}
        </p>
      </div>
      <div className="px-5 pb-5">
        <div className="mb-1.5 flex justify-between text-xs text-[#475569] dark:text-[#94a3b8]">
          <span>{goal.members.toLocaleString()} {t('goalMembers')}</span>
          <span className="font-bold text-[#059669]">{goal.progress}%</span>
        </div>
        <div className="mb-3 h-[7px] overflow-hidden rounded bg-[#e2e8f0] dark:bg-[#1e2d3d]">
          <div className="h-full rounded transition-all duration-1000" style={{ width: `${goal.progress}%`, background: goal.progressColor }} />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-[9px] bg-[#f8fafc] px-2.5 py-2 dark:bg-[#111827]">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[.4px] text-[#94a3b8]">
              {t('goalMonthly')}
            </div>
            <div className="text-[13px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">{goal.monthly}</div>
          </div>
          <div className="rounded-[9px] bg-[#f8fafc] px-2.5 py-2 dark:bg-[#111827]">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[.4px] text-[#94a3b8]">
              {t('goalDuration')}
            </div>
            <div className="text-[13px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">{goal.duration}</div>
          </div>
        </div>
        <div className="mb-3.5 flex items-center gap-1.5">
          <div className="flex">
            {goal.avatars.map(([letter, background], index) => (
              <div
                key={`${goal.id}-${letter}-${index}`}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white dark:border-[#1a2235] ${
                  index === 0 ? "" : "-ml-1.5"
                }`}
                style={{ background }}
              >
                {letter}
              </div>
            ))}
          </div>
          <span className="text-xs font-medium text-[#94a3b8]">{goal.memberText}</span>
        </div>
        <div className="mb-2 flex gap-1.5">
          {[
            [t('goalDetails'), Search, "/goal-detail"],
            [t('goalEdit'), Edit3, "/goal-edit"],
            [t('goalShare'), Share2, "/goal-share"],
          ].map(([label, ActionIcon, href]) => (
            <Link
              key={label}
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="flex flex-1 items-center justify-center gap-1 rounded-[9px] border border-[#e2e8f0] bg-white p-2 text-xs font-semibold text-[#0f172a] transition hover:border-[#059669] hover:text-[#059669] dark:border-[#1e2d3d] dark:bg-[#0a0f1e] dark:text-[#f1f5f9]"
            >
              <ActionIcon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onJoin(goal.id);
          }}
          className="w-full rounded-[11px] bg-[linear-gradient(135deg,#059669,#0891b2)] p-[11px] text-[13px] font-bold text-white shadow-[0_3px_10px_rgba(5,150,105,.25)] transition hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(5,150,105,.35)]"
        >
          {t('goalJoin').replace('{name}', goal.name.split(" ")[0])}
        </button>
      </div>
    </article>
  );
}

export default GoalsPage;
