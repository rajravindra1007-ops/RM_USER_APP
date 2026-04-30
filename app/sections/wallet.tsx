// app/sections/wallet.tsx

import { MaterialIcons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
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
  pink: "#ff0f7b",
  yellow: "#facc15",
  text: "#ffffff",
  subText: "#bfc3d9",
  cardDark: "#2b2d4d",
  green: "#22c55e",
  red: "#ff4d6d",
};

type TransactionRow = {
  id: string;
  title: string;
  date: string;
  amount: string;
  type: "Credit" | "Debit";
  balance: string;
  sortTime: number;
};

export default function WalletScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    let depositRows: TransactionRow[] = [];
    let withdrawalRows: TransactionRow[] = [];
    let withdrawalReqRows: TransactionRow[] = [];

    const updateFinalList = () => {
      const merged = [...depositRows, ...withdrawalRows, ...withdrawalReqRows]
        .sort((a, b) => b.sortTime - a.sortTime);
      setTransactions(merged);
      setLoading(false);
    };

    const userUnsub = db.collection("users").doc(uid).onSnapshot(
      (doc) => { setWalletBalance(Number(doc.data()?.wallet || 0)); },
      (error) => { console.log("User fetch error:", error); }
    );

    const depositUnsub = db
      .collection("todaysmanualdeposite")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        depositRows = snapshot.docs.map((doc) => {
          const data = doc.data();
          const dt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: `deposit_${doc.id}`,
            title: data?.method === "gateway" ? "Added From Gateway" : "Added By Admin",
            date: dt.toLocaleString("en-IN"),
            amount: `+₹${Number(data?.amount || 0).toLocaleString("en-IN")}`,
            type: "Credit",
            balance: `₹${Number(data?.postBalance || 0).toLocaleString("en-IN")}`,
            sortTime: dt.getTime(),
          };
        });
        updateFinalList();
      }, (error) => { console.log("Deposit fetch error:", error); });

    const withdrawalUnsub = db
      .collection("todaysmanualwithdrawal")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        withdrawalRows = snapshot.docs.map((doc) => {
          const data = doc.data();
          const dt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: `withdraw_${doc.id}`,
            title: "Withdrawal By Admin",
            date: dt.toLocaleString("en-IN"),
            amount: `-₹${Number(data?.amount || 0).toLocaleString("en-IN")}`,
            type: "Debit",
            balance: `₹${Number(data?.postBalance || 0).toLocaleString("en-IN")}`,
            sortTime: dt.getTime(),
          };
        });
        updateFinalList();
      }, (error) => { console.log("Withdrawal fetch error:", error); });

    const withdrawalReqUnsub = db
      .collection("todaysmanualwithdrawalReq")
      .where("requestedByUid", "==", uid)
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        withdrawalReqRows = snapshot.docs.map((doc) => {
          const data = doc.data();
          const dt = data?.createdAt?.toDate ? data.createdAt.toDate() : new Date();
          return {
            id: `withdraw_req_${doc.id}`,
            title: "Withdrawal By Request",
            date: dt.toLocaleString("en-IN"),
            amount: `-₹${Number(data?.withdrawalammount || 0).toLocaleString("en-IN")}`,
            type: "Debit",
            balance: `₹${Number(data?.postbalance || 0).toLocaleString("en-IN")}`,
            sortTime: dt.getTime(),
          };
        });
        updateFinalList();
      }, (error) => { console.log("Withdrawal request fetch error:", error); });

    return () => {
      userUnsub();
      depositUnsub();
      withdrawalUnsub();
      withdrawalReqUnsub();
    };
  }, []);

  const totalWithdrawals = useMemo(() => {
    return transactions
      .filter((t) => t.type === "Debit")
      .reduce((sum, item) => sum + Number(item.amount.replace(/[^\d]/g, "")), 0);
  }, [transactions]);

  const totalAdded = useMemo(() => {
    return transactions
      .filter((t) => t.type === "Credit")
      .reduce((sum, item) => sum + Number(item.amount.replace(/[^\d]/g, "")), 0);
  }, [transactions]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>
          <Link href="/sections/bid-history" asChild>
            <TouchableOpacity style={styles.historyBtn}>
              <MaterialIcons name="history" size={22} color={COLORS.yellow} />
            </TouchableOpacity>
          </Link>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            ₹ {walletBalance.toLocaleString("en-IN")}
          </Text>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.smallLabel}>Total Added</Text>
              <Text style={styles.greenText}>₹ {totalAdded.toLocaleString("en-IN")}</Text>
            </View>
            <View>
              <Text style={styles.smallLabel}>Total Withdrawals</Text>
              <Text style={styles.whiteText}>₹ {totalWithdrawals.toLocaleString("en-IN")}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/sections/add-money")}
          >
            <MaterialIcons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => router.push("/sections/withdraw-money")}
          >
            <MaterialIcons name="remove-circle-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.yellow} style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No transactions found</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.transactionCard}>
                <View style={styles.iconBox}>
                  <MaterialIcons
                    name={item.type === "Credit" ? "south" : "north"}
                    size={20}
                    color={item.type === "Credit" ? COLORS.green : COLORS.red}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transactionTitle}>{item.title}</Text>
                  <Text style={styles.transactionDate}>{item.date}</Text>
                  <Text style={styles.balanceText}>Balance: {item.balance}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.amount, { color: item.type === "Credit" ? COLORS.green : COLORS.red }]}>
                    {item.amount}
                  </Text>
                  <Text style={styles.credit}>{item.type}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerTitle: { color: COLORS.text, fontSize: 30, fontWeight: "800" },
  historyBtn: {
    width: 46, height: 46, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.yellow,
    justifyContent: "center", alignItems: "center",
  },
  balanceCard: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 18, marginBottom: 14,
  },
  balanceLabel: { color: "#fff", fontSize: 12 },
  balanceAmount: { color: "#fff", fontSize: 32, fontWeight: "800", marginVertical: 12 },
  balanceRow: { flexDirection: "row", justifyContent: "space-between" },
  smallLabel: { color: "#fff", fontSize: 11 },
  greenText: { color: COLORS.green, fontWeight: "700", marginTop: 4 },
  whiteText: { color: "#fff", fontWeight: "700", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  addBtn: {
    flex: 1, backgroundColor: COLORS.yellow, height: 46, borderRadius: 12,
    justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6,
  },
  withdrawBtn: {
    flex: 1, backgroundColor: COLORS.pink, height: 46, borderRadius: 12,
    justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 6,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: { color: "#d1d5db", fontSize: 18, fontWeight: "700", marginBottom: 14 },
  transactionCard: {
    backgroundColor: COLORS.cardDark, borderRadius: 18, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 12,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: "#344054",
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  transactionTitle: { color: "#fff", fontWeight: "700" },
  transactionDate: { color: "#9ca3af", fontSize: 12, marginTop: 4 },
  balanceText: { color: COLORS.yellow, marginTop: 4, fontWeight: "600" },
  amount: { fontWeight: "800", fontSize: 16 },
  credit: { color: "#cbd5e1", marginTop: 4, fontSize: 12 },
  emptyText: { color: "#9ca3af", textAlign: "center", marginTop: 40 },
});
