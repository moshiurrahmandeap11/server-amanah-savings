"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Download,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
  Save,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import axiosInstance from "../../../components/shared/AxiosInstance/AxiosInstance";

// Translations
const translations = {
  en: {
    userManagement: "👥 User Management",
    searchPlaceholder: "Search by name, phone, NID...",
    all: "All",
    active: "Active",
    pendingKyc: "Pending KYC",
    flagged: "Flagged",
    suspended: "Suspended",
    member: "Member",
    phone: "Phone",
    plan: "Plan",
    totalSaved: "Total Saved",
    kyc: "KYC",
    status: "Status",
    joined: "Joined",
    actions: "Actions",
    noUsersFound: "No users found",
    exportExcel: "Export Excel",
    exporting: "Exporting...",
    exportedSuccessfully: "✅ Exported users successfully!",
    exportFailed: "❌ Failed to export users",
    view: "View",
    approveKyc: "Approve KYC",
    suspend: "Suspend",
    ban: "Ban",
    message: "Message",
    accountOverview: "Account Overview",
    totalSavings: "Total Savings",
    totalDeposits: "Total Deposits",
    totalWithdrawals: "Total Withdrawals",
    level: "Level",
    memberSince: "Member Since",
    lastLogin: "Last Login",
    division: "Division",
    referralCode: "Referral Code",
    suspendConfirm: "Suspend user",
    banConfirm: "Ban user permanently?",
    kycApproved: "KYC approved successfully",
    actionFailed: "Action failed",
  },
  bn: {
    userManagement: "👥 ইউজার ম্যানেজমেন্ট",
    searchPlaceholder: "নাম, ফোন, এনআইডি দিয়ে খুঁজুন...",
    all: "সব",
    active: "সক্রিয়",
    pendingKyc: "পেন্ডিং কেওয়াইসি",
    flagged: "ফ্ল্যাগড",
    suspended: "সাসপেন্ডেড",
    member: "মেম্বার",
    phone: "ফোন",
    plan: "প্ল্যান",
    totalSaved: "মোট সঞ্চয়",
    kyc: "কেওয়াইসি",
    status: "স্ট্যাটাস",
    joined: "জয়েন",
    actions: "অ্যাকশন",
    noUsersFound: "কোনো ইউজার পাওয়া যায়নি",
    exportExcel: "এক্সেল এক্সপোর্ট",
    exporting: "এক্সপোর্ট হচ্ছে...",
    exportedSuccessfully: "✅ ইউজার এক্সপোর্ট সফল হয়েছে!",
    exportFailed: "❌ এক্সপোর্ট ব্যর্থ হয়েছে",
    view: "দেখুন",
    approveKyc: "কেওয়াইসি অনুমোদন",
    suspend: "সাসপেন্ড",
    ban: "ব্যান",
    message: "মেসেজ",
    accountOverview: "অ্যাকাউন্ট ওভারভিউ",
    totalSavings: "মোট সঞ্চয়",
    totalDeposits: "মোট ডিপোজিট",
    totalWithdrawals: "মোট উত্তোলন",
    level: "লেভেল",
    memberSince: "মেম্বার সাইন আপ",
    lastLogin: "শেষ লগইন",
    division: "বিভাগ",
    referralCode: "রেফারেল কোড",
    suspendConfirm: "ইউজার সাসপেন্ড করবেন?",
    banConfirm: "ইউজারকে স্থায়ীভাবে ব্যান করবেন?",
    kycApproved: "কেওয়াইসি অনুমোদিত হয়েছে",
    actionFailed: "অ্যাকশন ব্যর্থ হয়েছে",
  }
};

const UserManagementPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    occupation: "",
    income: "",
    division: "",
    district: "",
    upazila: "",
    village: "",
    postOffice: "",
    postCode: "",
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });
  const [lang, setLang] = useState("bn");

  // Load language preference
  useEffect(() => {
    const savedLang = localStorage.getItem("admin_lang") || "bn";
    setLang(savedLang);
  }, []);

  const t = (key) => translations[lang]?.[key] || translations.en[key] || key;

  const filters = ["All", "Active", "Pending KYC", "Flagged", "Suspended"];

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const formatCurrency = (amount) => {
    if (amount == null) return "৳0";
    return `৳${Number(amount).toLocaleString("en-BD")}`;
  };

  const formatDateInput = (date) => {
    if (!date) return "";
    return String(date).split("T")[0];
  };

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      let status = "";
      let kycStatus = "";
      if (activeFilter === "Active") status = "active";
      else if (activeFilter === "Suspended") status = "suspended";
      else if (activeFilter === "Flagged") status = "banned";
      else if (activeFilter === "Pending KYC") kycStatus = "pending";

      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", pagination.itemsPerPage);
      if (searchQuery) params.append("search", searchQuery);
      if (status) params.append("status", status);
      if (kycStatus) params.append("kycStatus", kycStatus);

      const res = await axiosInstance.get(`/admin/users?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        setUsers(res.data.data.users);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      showToastMessage(err.response?.data?.message || t('actionFailed'), "error");
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchQuery, pagination.itemsPerPage, lang]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const updateUserStatus = async (userId, updates) => {
    try {
      const res = await axiosInstance.patch(
        `/admin/users/${userId}/status`,
        updates,
        { headers: getAuthHeaders() }
      );
      if (res.data.success) {
        showToastMessage(res.data.message, "success");
        fetchUsers(pagination.currentPage);
      }
    } catch (err) {
      showToastMessage(err.response?.data?.message || t('actionFailed'), "error");
    }
  };

  const approveKyc = async (userId) => {
    try {
      const res = await axiosInstance.patch(
        `/admin/users/${userId}/kyc`,
        { status: "approved" },
        { headers: getAuthHeaders() }
      );
      if (res.data.success) {
        showToastMessage(t('kycApproved'), "success");
        fetchUsers(pagination.currentPage);
      }
    } catch (err) {
      showToastMessage(err.response?.data?.message || t('actionFailed'), "error");
    }
  };

  const showToastMessage = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const openUserModal = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
    document.body.style.overflow = "hidden";
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    document.body.style.overflow = "auto";
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      phone: user.phone || "",
      email: user.email || "",
      dob: formatDateInput(user.dob),
      gender: user.gender || "",
      occupation: user.occupation || "",
      income: user.income || "",
      division: user.division || "",
      district: user.district || "",
      upazila: user.upazila || "",
      village: user.village || "",
      postOffice: user.postOffice || "",
      postCode: user.postCode || "",
    });
    setShowEditModal(true);
    document.body.style.overflow = "hidden";
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setSavingEdit(false);
    document.body.style.overflow = "auto";
  };

  const handleEditFormChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitEditForm = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingEdit(true);
    try {
      const payload = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        email: editForm.email,
        dob: editForm.dob,
        gender: editForm.gender,
        occupation: editForm.occupation,
        income: editForm.income,
        division: editForm.division,
        district: editForm.district,
        upazila: editForm.upazila,
        village: editForm.village,
        postOffice: editForm.postOffice,
        postCode: editForm.postCode,
      };

      const res = await axiosInstance.patch(
        `/admin/users/${editingUser.id}/personal-info`,
        payload,
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        const updatedUser = res.data.data?.user || {
          ...editingUser,
          ...payload,
          fullName: `${payload.firstName || ""} ${payload.lastName || ""}`.trim(),
        };

        setUsers((prev) =>
          prev.map((user) => (user.id === editingUser.id ? { ...user, ...updatedUser } : user))
        );
        if (selectedUser?.id === editingUser.id) {
          setSelectedUser((prev) => ({ ...prev, ...updatedUser }));
        }
        showToastMessage(res.data.message || "User updated successfully", "success");
        closeEditModal();
      }
    } catch (err) {
      showToastMessage(err.response?.data?.message || t('actionFailed'), "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAction = (action, user) => {
    if (action === "suspend") {
      if (confirm(`${t('suspendConfirm')} ${user.fullName || user.firstName}?`)) {
        updateUserStatus(user.id, { isSuspended: true });
      }
    } else if (action === "ban") {
      if (confirm(`${t('banConfirm')} ${user.fullName || user.firstName}?`)) {
        updateUserStatus(user.id, { isBanned: true });
      }
    } else if (action === "approveKYC") {
      approveKyc(user.id);
    }
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      let status = "";
      let kycStatus = "";
      if (activeFilter === "Active") status = "active";
      else if (activeFilter === "Suspended") status = "suspended";
      else if (activeFilter === "Flagged") status = "banned";
      else if (activeFilter === "Pending KYC") kycStatus = "pending";

      const params = new URLSearchParams();
      params.append("page", 1);
      params.append("limit", 999999);
      if (searchQuery) params.append("search", searchQuery);
      if (status) params.append("status", status);
      if (kycStatus) params.append("kycStatus", kycStatus);
      params.append("export", "true");

      const res = await axiosInstance.get(`/admin/users?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        const allUsers = res.data.data.users;

        const excelData = allUsers.map((user, index) => ({
          "SL No": index + 1,
          "Full Name": user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          "Phone": user.phone,
          "Email": user.email || "N/A",
          "Plan": user.selectedPlan || "Bronze",
          "Total Saved (৳)": user.totalSaved || 0,
          "KYC Status": user.kycStatus === "approved" ? "Approved" : user.kycStatus === "pending" ? "Pending" : "Rejected",
          "Account Status": user.isBanned ? "Banned" : user.isSuspended ? "Suspended" : "Active",
          "Joined Date": new Date(user.createdAt).toLocaleDateString("en-GB"),
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet["!cols"] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

        saveAs(blob, `users-${new Date().toISOString().split("T")[0]}.xlsx`);
        showToastMessage(t('exportedSuccessfully'), "success");
      }
    } catch (error) {
      console.error("Export error:", error);
      showToastMessage(t('exportFailed'), "error");
    } finally {
      setExporting(false);
    }
  };

  const getBadgeClass = (type, color) => {
    const classes = {
      ok: "bg-green-500/20 dark:bg-green-500/30 text-green-500 dark:text-green-400",
      warn: "bg-amber-500/20 dark:bg-amber-500/30 text-amber-500 dark:text-amber-400",
      info: "bg-blue-500/20 dark:bg-blue-500/30 text-blue-500 dark:text-blue-400",
      danger: "bg-red-500/20 dark:bg-red-500/30 text-red-500 dark:text-red-400",
      gray: "bg-gray-500/20 dark:bg-gray-500/30 text-gray-500 dark:text-gray-400",
    };
    return classes[color] || classes.ok;
  };

  const getKycDisplay = (kycStatus) => {
    if (kycStatus === "approved") return { label: "✅ Verified", color: "ok" };
    if (kycStatus === "pending") return { label: "⚠️ Pending", color: "warn" };
    return { label: "🔄 In Review", color: "info" };
  };

  const getStatusDisplay = (user) => {
    if (user.isBanned) return { label: "🚫 Banned", color: "danger" };
    if (user.isSuspended) return { label: "⏸️ Suspended", color: "warn" };
    if (!user.accountActive) return { label: "⏳ Inactive", color: "gray" };
    return { label: "Active", color: "ok" };
  };

  const getPlanDisplay = (plan) => {
    const map = {
      gold: { emoji: "🥇", label: "Gold", color: "warn" },
      silver: { emoji: "🥈", label: "Silver", color: "info" },
      platinum: { emoji: "💎", label: "Platinum", color: "purple" },
      bronze: { emoji: "🥉", label: "Bronze", color: "gray" },
    };
    return map[plan?.toLowerCase()] || map.bronze;
  };

  const getAvatarBg = (index) => {
    const colors = [
      "from-primary to-primary-light",
      "from-blue-500 to-purple-500",
      "from-red-500 to-orange-500",
      "from-purple-500 to-indigo-500",
      "from-green-500 to-teal-500",
    ];
    return colors[index % colors.length];
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const editFields = [
    { name: "firstName", label: "First Name", required: true },
    { name: "lastName", label: "Last Name" },
    { name: "phone", label: "Phone", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "dob", label: "Date of Birth", type: "date" },
    { name: "gender", label: "Gender" },
    { name: "occupation", label: "Occupation" },
    { name: "income", label: "Income" },
    { name: "division", label: "Division" },
    { name: "district", label: "District" },
    { name: "upazila", label: "Upazila" },
    { name: "village", label: "Village" },
    { name: "postOffice", label: "Post Office" },
    { name: "postCode", label: "Post Code" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h2 className="text-lg font-bold text-foreground">{t('userManagement')}</h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background/80 dark:bg-background/60 backdrop-blur-sm">
          <Search size={16} className="text-foreground/50" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchUsers(1)}
            className="flex-1 bg-transparent outline-none text-sm text-foreground"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {["All", "Active", "Pending KYC", "Flagged", "Suspended"].map((filter) => (
            <button
              key={filter}
              onClick={() => { setActiveFilter(filter); fetchUsers(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 ${
                activeFilter === filter
                  ? "bg-gradient-to-r from-primary to-primary-light text-white border-primary shadow-lg shadow-primary/20"
                  : "border-border bg-card/80 dark:bg-card/60 backdrop-blur-sm text-foreground/60 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              {t(filter.toLowerCase().replace(/\s+/g, ''))}
            </button>
          ))}

          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-light text-white text-xs font-semibold flex items-center gap-1 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t('exporting')}
              </>
            ) : (
              <>
                <Download size={12} /> {t('exportExcel')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card/90 dark:bg-card/80 backdrop-blur-sm border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-border/50 dark:border-border/30 bg-background/80 dark:bg-background/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('member')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('phone')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('plan')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('totalSaved')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('kyc')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('joined')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/60">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-foreground/50">
                        {t('noUsersFound')}
                      </td>
                    </tr>
                  ) : (
                    users.map((user, idx) => {
                      const kyc = getKycDisplay(user.kycStatus);
                      const status = getStatusDisplay(user);
                      const plan = getPlanDisplay(user.selectedPlan);
                      const avatar = user.firstName?.[0]?.toUpperCase() || "?";

                      return (
                        <tr key={user.id} className="border-b border-border/50 dark:border-border/30 last:border-0 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-200">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getAvatarBg(idx)} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                                {avatar}
                              </div>
                              <div>
                                <div className="font-semibold text-sm text-foreground">
                                  {user.fullName || `${user.firstName} ${user.lastName || ""}`.trim()}
                                </div>
                                <div className="text-xs text-foreground/50">{user.email || "No email"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{user.phone}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getBadgeClass(plan.label, plan.color)}`}>
                              {plan.emoji} {plan.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-primary">
                            {formatCurrency(user?.totalSaved)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getBadgeClass(kyc.label, kyc.color)}`}>
                              {kyc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getBadgeClass(status.label, status.color)}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-foreground/50">{formatDate(user.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openUserModal(user)} className="p-1.5 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300">
                                <Eye size={14} className="text-foreground/70" />
                              </button>
                              <button onClick={() => openEditModal(user)} className="p-1.5 rounded-lg border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition-all duration-300">
                                <Edit size={14} />
                              </button>
                              {user.isBanned ? (
                                <button onClick={() => handleAction("suspend", user)} className="p-1.5 rounded-lg border border-green-500/30 text-green-500 hover:bg-green-500/10 transition-all duration-300">
                                  <CheckCircle size={14} />
                                </button>
                              ) : user.kycStatus === "pending" ? (
                                <button onClick={() => handleAction("approveKYC", user)} className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all duration-300">
                                  <CheckCircle size={14} />
                                </button>
                              ) : (
                                <button onClick={() => handleAction("suspend", user)} className="p-1.5 rounded-lg border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-all duration-300">
                                  <XCircle size={14} />
                                </button>
                              )}
                              {!user.isBanned && (
                                <button onClick={() => handleAction("ban", user)} className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-all duration-300">
                                  <Ban size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t border-border/50 dark:border-border/30 bg-background/80 dark:bg-background/60">
              <div className="text-xs text-foreground/50">
                Showing {users.length} of {pagination.totalItems} members
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchUsers(pagination.currentPage - 1)}
                  disabled={pagination.currentPage <= 1}
                  className="px-3 py-1 rounded-lg border border-border/60 dark:border-border/40 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => fetchUsers(page)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-300 ${
                        pagination.currentPage === page
                          ? "bg-gradient-to-r from-primary to-primary-light text-white shadow-lg shadow-primary/20"
                          : "border border-border/60 dark:border-border/40 hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => fetchUsers(pagination.currentPage + 1)}
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="px-3 py-1 rounded-lg border border-border/60 dark:border-border/40 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeUserModal}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card/95 dark:bg-card/90 backdrop-blur-sm rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Content - Same as before */}
              <div className="bg-gradient-to-r from-primary to-primary-light p-6 text-white relative">
                <button onClick={closeUserModal} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all duration-300">✕</button>
                <div className="flex flex-col items-center">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${getAvatarBg(0)} flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg`}>
                    {selectedUser.firstName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="text-xl font-bold">{selectedUser.fullName || `${selectedUser.firstName} ${selectedUser.lastName || ""}`.trim()}</div>
                  <div className="text-sm text-white/80">{selectedUser.phone} · {selectedUser.email || "No email"}</div>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-5">
                  <div className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-3">{t('accountOverview')}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/90 dark:bg-background/80 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                      <div className="text-[10px] text-foreground/50">{t('totalSavings')}</div>
                      <div className="text-lg font-bold text-primary">{formatCurrency(selectedUser.totalSaved)}</div>
                    </div>
                    <div className="bg-background/90 dark:bg-background/80 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                      <div className="text-[10px] text-foreground/50">{t('totalDeposits')}</div>
                      <div className="text-lg font-bold text-foreground">{selectedUser.totalDeposits || 0}</div>
                    </div>
                    <div className="bg-background/90 dark:bg-background/80 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                      <div className="text-[10px] text-foreground/50">{t('totalWithdrawals')}</div>
                      <div className="text-lg font-bold text-foreground">{selectedUser.totalWithdrawals || 0}</div>
                    </div>
                    <div className="bg-background/90 dark:bg-background/80 backdrop-blur-sm rounded-xl p-3 border border-border/50">
                      <div className="text-[10px] text-foreground/50">{t('level')}</div>
                      <div className="text-lg font-bold text-foreground">{selectedUser.level || 1}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border/50 dark:border-border/30 flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300">{t('message')}</button>
                <button onClick={() => { handleAction("suspend", selectedUser); closeUserModal(); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all duration-300">{t('suspend')}</button>
                <button onClick={() => { handleAction("ban", selectedUser); closeUserModal(); }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300">{t('ban')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card/95 dark:bg-card/90 backdrop-blur-sm rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-white relative">
                <button onClick={closeEditModal} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all duration-300">x</button>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${getAvatarBg(1)} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
                    {editingUser.firstName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="text-xl font-bold">Edit User Info</div>
                    <div className="text-sm text-white/80">
                      {editingUser.fullName || `${editingUser.firstName || ""} ${editingUser.lastName || ""}`.trim()}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={submitEditForm} className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editFields.map((field) => (
                    <label key={field.name} className="block">
                      <span className="block text-xs font-semibold text-foreground/60 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500"> *</span>}
                      </span>
                      <input
                        type={field.type || "text"}
                        value={editForm[field.name] || ""}
                        required={field.required}
                        onChange={(e) => handleEditFormChange(field.name, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background/80 dark:bg-background/60 text-sm text-foreground outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 border-t border-border/50 dark:border-border/30 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl border border-border/60 text-sm font-semibold text-foreground/70 hover:border-foreground/30 hover:bg-foreground/5 transition-all duration-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50"
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-sm shadow-lg whitespace-nowrap max-w-[90vw] text-center backdrop-blur-sm ${
              toast.type === "error" ? "bg-red-500/90" : "bg-green-500/90"
            } text-white`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagementPage;
