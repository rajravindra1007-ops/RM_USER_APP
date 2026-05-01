import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
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
  subText: "#8b90b8",
  cardDark: "#1c1e3a",
  green: "#22c55e",
  red: "#ff4d6d",
};

type TxnCategory = "deposit" | "withdrawal";

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
};

export default function WalletScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [activeTab, setActiveTab] = useState<TxnCategory>("deposit");

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

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

    const userUnsub = db.collection("users").doc(uid).onSnapshot((doc) => {
      setWalletBalance(Number(doc.data()?.wallet || 0));
    });

    const depositUnsub = db
      .collection("TodaysAddMoneyByGetway")
      .where("userId", "==", uid)
      .onSnapshot((snap) => {
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
            balance: `₹${Number(d?.postBalance || 0).toLocaleString("en-IN")}`,
            sortTime: dt.getTime(),
            category: "deposit",
          };
        });

        updateFinal();
      });

    const withdrawUnsub = db
      .collection("users")
      .doc(uid)
      .collection("userWithdrawal")
      .onSnapshot((snap) => {
        withdrawalRows = snap.docs.map((doc) => {
          const d = doc.data();
          const dt = d?.createdAt?.toDate?.() || new Date();

          return {
            id: doc.id,
            title: "Withdrawal Request",
            subtitle: d?.upiId || d?.accountNo || "-",
            date: dt.toLocaleString("en-IN"),
            amount: `-₹${Number(d?.amount || 0).toLocaleString("en-IN")}`,
            type: "Debit",
            balance: `₹${Number(d?.postBalance || 0).toLocaleString("en-IN")}`,
            sortTime: dt.getTime(),
            category: "withdrawal",
          };
        });

        updateFinal();
      });

    return () => {
      userUnsub();
      depositUnsub();
      withdrawUnsub();
    };
  }, []);

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
            <MaterialIcons name="add" size={18} color="#000" />
            <Text style={styles.addText}>Add Money</Text>
          </TouchableOpacity>
        </View>

        {/* CHIPS */}
        <View style={styles.chipRow}>
          <Chip title="Deposit" active={activeTab === "deposit"} onPress={() => setActiveTab("deposit")} />
          <Chip title="Withdraw" active={activeTab === "withdrawal"} onPress={() => setActiveTab("withdrawal")} />
        </View>

        {/* LIST */}
        {loading ? (
          <ActivityIndicator color={COLORS.yellow} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="inbox" size={50} color={COLORS.subText} />
            <Text style={styles.emptyText}>
              No {activeTab === "deposit" ? "Deposits" : "Withdrawals"} Found
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.card}>

                {/* TOP */}
                <View style={styles.topRow}>
                  <View>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.txnId}>ID: {item.subtitle}</Text>
                  </View>

                  <Text
                    style={[
                      styles.amount,
                      { color: item.type === "Credit" ? COLORS.green : COLORS.red },
                    ]}
                  >
                    {item.amount}
                  </Text>
                </View>

                {/* DETAILS */}
                <View style={styles.row}>
                  <Text style={styles.label}>Date</Text>
                  <Text style={styles.value}>{item.date}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Balance After</Text>
                  <Text style={styles.value}>{item.balance}</Text>
                </View>

              </View>
            )}
          />
        )}

      </SafeAreaView>

      <BottomNav active="wallet" />
    </>
  );
}

/* CHIP */
function Chip({ title, active, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={{ color: active ? "#000" : "#fff", fontWeight: "700" }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#11132d", padding: 14 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },

  iconBtn: {
    backgroundColor: "#1c1e3a",
    padding: 8,
    borderRadius: 10,
  },

  balanceCard: {
    backgroundColor: "#ffb400",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  balanceLabel: { color: "#000" },
  balanceAmount: { fontSize: 26, fontWeight: "800", color: "#fff" },

  addBtn: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    gap: 4,
  },

  addText: { fontWeight: "800", color: "#000", fontSize: 12 },

  chipRow: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 10,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1c1e3a",
  },

  chipActive: {
    backgroundColor: "#facc15",
  },

  card: {
    backgroundColor: "#1c1e3a",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  title: {
    color: "#fff",
    fontWeight: "800",
  },

  txnId: {
    color: "#8b90b8",
    fontSize: 11,
  },

  amount: {
    fontWeight: "900",
    fontSize: 15,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  label: {
    color: "#9ca3af",
    fontSize: 11,
  },

  value: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
  },

  emptyText: {
    color: "#8b90b8",
    marginTop: 10,
    fontWeight: "600",
  },
});