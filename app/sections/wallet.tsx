// app/sections/wallet.tsx

import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import BottomNav from "../components/BottomNav";

const COLORS = {
  bg: "#11132d",
  card: "#ffb400",
  yellow: "#facc15",
  gold:'#f5c518',
  subText: "#8b90b8",
  cardDark: "#1c1e3a",
  green: "#22c55e",
  red: "#ff4d6d",
  orange: "#f97316",
};

type TxnCategory = "deposit" | "withdrawal";

type PaymentStatus = "success" | "pending" | "failed" | "unknown";

type TransactionRow = {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  amount: string;
  type: "Credit" | "Debit";
  balance: string;
  sortTime: number;
  category: TxnCategory;
  paymentStatus: PaymentStatus;
};

/* maps any raw Firestore status string → canonical PaymentStatus */
function normalizeStatus(raw?: unknown): PaymentStatus {
  if (!raw || typeof raw !== "string") return "unknown";
  const s = raw.toLowerCase().trim();
  if (s === "success" || s === "completed" || s === "paid" || s === "approved")
    return "success";
  if (s === "pending" || s === "processing" || s === "initiated")
    return "pending";
  if (s === "failed" || s === "failure" || s === "rejected" || s === "cancelled")
    return "failed";
  return "unknown";
}

export default function WalletScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [activeTab, setActiveTab] = useState<TxnCategory>("deposit");
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;

    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let depositRows: TransactionRow[] = [];
    let withdrawalRows: TransactionRow[] = [];

    const updateFinal = () => {
      setTransactions(
        [...depositRows, ...withdrawalRows].sort(
          (a, b) => b.sortTime - a.sortTime
        )
      );
      setLoading(false);
    };

    const userUnsub = db
      .collection("users")
      .doc(uid)
      .onSnapshot((doc) => {
        setWalletBalance(Number(doc.data()?.wallet || 0));
      });

    /* ===========================
       DEPOSIT LISTENER
    =========================== */
    const depositRef = showTodayOnly
      ? db
          .collection("TodaysAddMoneyByGetway")
          .where("userId", "==", uid)
      : db
          .collection("users")
          .doc(uid)
          .collection("AddMoneyByGetway")
          .orderBy("createdAt", "desc");

    const depositUnsub = depositRef.onSnapshot((snap) => {
      depositRows = snap.docs.map((doc) => {
        const d = doc.data();
        const dt = d?.createdAt?.toDate?.() || new Date();

        return {
          id: doc.id,
          title: "Deposit Added",
          subtitle: d?.client_txn_id || "-",
          date: dt.toLocaleString("en-IN"),
          amount: `+₹${Number(d?.amount || 0).toLocaleString("en-IN")}`,
          type: "Credit",
          balance: `₹${Number(
            d?.postBalance ?? d?.wallet ?? 0
          ).toLocaleString("en-IN")}`,
          sortTime: dt.getTime(),
          category: "deposit",
          paymentStatus: normalizeStatus(
            d?.paymentstatus ?? d?.status ?? d?.paymentStatus ?? d?.payment_status ??
            d?.txnStatus ?? d?.txn_status ?? d?.Status
          ),
        };
      });

      updateFinal();
    });

    /* ===========================
       WITHDRAWAL LISTENER
    =========================== */
    const withdrawRef = showTodayOnly
      ? db
          .collection("todaysWithdrawalReq")
          .where("requestedByUid", "==", uid)
      : db
          .collection("users")
          .doc(uid)
          .collection("userWithdrawal")
          .orderBy("createdAt", "desc");

    const withdrawUnsub = withdrawRef.onSnapshot((snap) => {
      withdrawalRows = snap.docs.map((doc) => {
        const d = doc.data();
        const dt = d?.createdAt?.toDate?.() || new Date();

        const amount =
          d?.amount ?? d?.withdrawalammount ?? d?.withdrawalAmount ?? 0;

        return {
          id: doc.id,
          title: "Withdrawal Request",
          subtitle:
            d?.upiId || d?.accountNo || d?.account || "-",
          date: dt.toLocaleString("en-IN"),
          amount: `-₹${Number(amount).toLocaleString("en-IN")}`,
          type: "Debit",
          balance: `₹${Number(d?.postBalance ?? 0).toLocaleString("en-IN")}`,
          sortTime: dt.getTime(),
          category: "withdrawal",
          paymentStatus: normalizeStatus(
            d?.paymentstatus ?? d?.status ?? d?.paymentStatus ?? d?.payment_status ??
            d?.txnStatus ?? d?.txn_status ?? d?.Status
          ),
        };
      });

      updateFinal();
    });

    return () => {
      userUnsub();
      depositUnsub();
      withdrawUnsub();
    };
  }, [showTodayOnly]);

  const filtered = useMemo(
    () => transactions.filter((t) => t.category === activeTab),
    [transactions, activeTab]
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.push("/sections/bid-history")}
          >
            <MaterialIcons name="history" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* BALANCE */}
        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              ₹ {walletBalance.toLocaleString("en-IN")}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/sections/add-money")}
          >
            <MaterialIcons name="add" size={18} color="#2ed111" />
            <Text style={styles.addText}>Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* CHIPS */}
        <View style={styles.chipRow}>
          <Chip
            title="Deposit"
            active={activeTab === "deposit"}
            onPress={() => setActiveTab("deposit")}
          />
          <Chip
            title="Withdraw"
            active={activeTab === "withdrawal"}
            onPress={() => setActiveTab("withdrawal")}
          />
        </View>

        {/* TODAY SWITCH */}
        <View style={styles.todaySwitchRow}>
          <Text style={styles.todayText}>Today Only</Text>
          <Switch
            value={showTodayOnly}
            onValueChange={setShowTodayOnly}
            trackColor={{ false: "#555", true: COLORS.green }}
            thumbColor="#fff"
          />
        </View>

        {/* LIST */}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.yellow}
            style={{ marginTop: 40 }}
          />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="inbox" size={54} color={COLORS.subText} />
            <Text style={styles.emptyText}>
              No {activeTab === "deposit" ? "Deposits" : "Withdrawals"} Found
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => <TransactionCard item={item} />}
          />
        )}
      </SafeAreaView>

      <BottomNav active="wallet" />
    </>
  );
}

/* ─────────────────────────────────────────
   STATUS BADGE CONFIG
───────────────────────────────────────── */
const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  success: { label: "Success",  color: COLORS.green,  bg: "rgba(34,197,94,0.15)",   icon: "check-circle"    },
  pending: { label: "Pending",  color: COLORS.orange, bg: "rgba(249,115,22,0.15)",  icon: "hourglass-top"   },
  failed:  { label: "Failed",   color: COLORS.red,    bg: "rgba(255,77,109,0.15)",  icon: "cancel"          },
  unknown: { label: "Unknown",  color: COLORS.subText,bg: "rgba(139,144,184,0.15)", icon: "help-outline"    },
};

/* ─────────────────────────────────────────
   TRANSACTION CARD  — clean airy layout
───────────────────────────────────────── */
function TransactionCard({ item }: { item: TransactionRow }) {
  const isCredit = item.type === "Credit";
  const status   = STATUS_CONFIG[item.paymentStatus] ?? STATUS_CONFIG["unknown"];

  const amountColor =
    item.paymentStatus === "pending"
      ? COLORS.orange
      : isCredit
      ? COLORS.green
      : COLORS.red;

  return (
    <View style={styles.card}>

      {/* ── TOP: arrow circle + title block + (timestamp + amount) ── */}
      <View style={styles.cardTopRow}>

        {/* Arrow circle — orange when pending */}
        <View style={[styles.arrowCircle, {
          backgroundColor:
            item.paymentStatus === "pending"
              ? "rgba(249,115,22,0.15)"
              : isCredit
              ? "rgba(34,197,94,0.15)"
              : "rgba(255,77,109,0.15)",
        }]}>
          <MaterialIcons
            name={isCredit ? "arrow-downward" : "arrow-upward"}
            size={18}
            color={
              item.paymentStatus === "pending"
                ? COLORS.orange
                : isCredit
                ? COLORS.green
                : COLORS.red
            }
          />
        </View>

        {/* Title + status badge */}
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg, marginTop: 5 }]}>
            <MaterialIcons
              name={status.icon as any}
              size={11}
              color={status.color}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Right side: timestamp above amount */}
        <View style={styles.cardRightBlock}>
          <Text style={styles.cardTimestamp}>{item.date}</Text>
          <Text style={[styles.cardAmount, { color: amountColor }]}>
            {item.amount}
          </Text>
        </View>

      </View>

      {/* ── DIVIDER ── */}
      <View style={styles.divider} />

      {/* ── BOTTOM: TXN ID only ── */}
      <View style={styles.txnRow}>
        <Text style={styles.metaLabel}>TXN ID</Text>
        <Text style={styles.metaValue} numberOfLines={1}>{item.subtitle}</Text>
      </View>

    </View>
  );
}

/* ─────────────────────────────────────────
   CHIP
───────────────────────────────────────── */
function Chip({ title, active, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={{ color: active ? "#000" : "#fff", fontWeight: "800" }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 14,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },

  iconBtn: {
    backgroundColor: COLORS.cardDark,
    padding: 10,
    borderRadius: 12,
  },

  balanceCard: {
    backgroundColor: COLORS.gold,
    padding: 12,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  balanceLabel: {
    color: "#000",
    fontSize: 13,
    fontWeight: "600",
  },

  balanceAmount: {
    fontSize: 30,
    fontWeight: "900",
    color: "#000",
    marginTop: 4,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 5,
  },

  addText: {
    color: "#2ed111",
    fontWeight: "800",
    fontSize: 13,
  },

  chipRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  chip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 30,
    backgroundColor: COLORS.cardDark,
  },

  chipActive: {
    backgroundColor: COLORS.yellow,
  },

  todaySwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  todayText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },

  emptyText: {
    color: COLORS.subText,
    marginTop: 12,
    fontWeight: "700",
    fontSize: 15,
  },

  /* ── Card ── */
  card: {
    backgroundColor: COLORS.cardDark,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },

  arrowCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  cardTitleBlock: {
    flex: 1,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  cardSubtitle: {
    color: COLORS.subText,
    fontSize: 12,
    marginTop: 2,
  },

  cardAmount: {
    fontSize: 17,
    fontWeight: "900",
    flexShrink: 0,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  statusRow: {
    marginTop: 10,
    flexDirection: "row",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginVertical: 14,
  },

  /* ── Right block (timestamp + amount) ── */
  cardRightBlock: {
    alignItems: "flex-end",
    flexShrink: 0,
    marginLeft: 8,
  },

  cardTimestamp: {
    color: COLORS.subText,
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 4,
  },

  /* ── TXN ID bottom row ── */
  txnRow: {
    flexDirection: "row",
    
    alignItems: "center",
    gap: 8,
  },

  metaLabel: {
    color: COLORS.subText,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  metaValue: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginBottom:5
  },
});
