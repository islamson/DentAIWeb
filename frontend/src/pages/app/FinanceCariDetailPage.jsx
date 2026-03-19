"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { formatCurrency } from "../../lib/utils";
import {
    ArrowLeft,
    Building2,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    Download,
    Phone,
    LocateFixed,
    FileText,
    Search,
    ChevronLeft,
    ChevronRight,
    Scale,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const ACCOUNT_TYPE_LABELS = {
    SUPPLIER: "Tedarikçi", LAB: "Laboratuvar", EXTERNAL_INSTITUTION: "Kurum", VENDOR: "Satıcı",
    DOCTOR: "Hekim", PERSONNEL: "Personel", HEALTH_AGENCY: "Sağlık Acentesi",
    OPERATING_EXPENSE: "İşletme Gideri", MEDICAL: "Medikal", BANK: "Banka", CASH: "Kasa", OTHER: "Diğer",
};

const TX_TYPE_LABELS = {
    DEBIT: "Borç", CREDIT: "Alacak",
};

const PAGE_SIZE = 20;

export default function FinanceCariDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [account, setAccount] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [txPagination, setTxPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [txPage, setTxPage] = useState(1);
    const [showNewTx, setShowNewTx] = useState(false);
    const [txForm, setTxForm] = useState({ transactionType: "DEBIT", amount: "", description: "", reference: "", paymentMethod: "", vatRate: 0 });
    const [saving, setSaving] = useState(false);

    // Fetch all accounts for sidebar
    useEffect(() => {
        fetch("/api/current-accounts?limit=999")
            .then(r => r.json())
            .then(d => setAccounts(d.accounts || []))
            .catch(() => { });
    }, []);

    // Fetch selected account detail
    useEffect(() => {
        fetchAccountDetails();
    }, [id]);

    // Fetch transactions for selected account
    useEffect(() => {
        if (id) fetchTransactions(txPage);
    }, [id, txPage]);

    const fetchAccountDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/current-accounts/${id}`);
            if (!res.ok) throw new Error("Failed to fetch account details");
            const data = await res.json();
            setAccount(data.account);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async (page) => {
        try {
            setTxLoading(true);
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(PAGE_SIZE));
            const res = await fetch(`/api/current-accounts/${id}/transactions?${params}`);
            const data = await res.json();
            setTransactions(data.transactions || []);
            setTxPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (error) {
            console.error(error);
        } finally {
            setTxLoading(false);
        }
    };

    const handleNewTransaction = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const body = {
                transactionType: txForm.transactionType,
                amount: parseInt(txForm.amount, 10),
                description: txForm.description || undefined,
                reference: txForm.reference || undefined,
                paymentMethod: txForm.paymentMethod || undefined,
                vatRate: txForm.vatRate || 0,
            };
            const res = await fetch(`/api/current-accounts/${id}/transactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || "İşlem oluşturulamadı");
                return;
            }
            setShowNewTx(false);
            setTxForm({ transactionType: "DEBIT", amount: "", description: "", reference: "", paymentMethod: "", vatRate: 0 });
            fetchAccountDetails();
            fetchTransactions(txPage);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        if (!transactions.length) return;
        const rows = transactions.map(tx => ({
            Tarih: tx.occurredAt ? format(new Date(tx.occurredAt), "dd.MM.yyyy HH:mm", { locale: tr }) : "-",
            Tür: TX_TYPE_LABELS[tx.transactionType] || tx.transactionType,
            Açıklama: tx.description || "-",
            "Belge No": tx.reference || "-",
            "Borç (₺)": tx.debit > 0 ? (tx.debit / 100).toFixed(2) : "",
            "Alacak (₺)": tx.credit > 0 ? (tx.credit / 100).toFixed(2) : "",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hesap Hareketleri");
        XLSX.writeFile(wb, `cari_${account?.name || "detail"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    // Group accounts by type for sidebar
    const groupedAccounts = {};
    accounts.forEach(a => {
        const type = a.type || "OTHER";
        if (!groupedAccounts[type]) groupedAccounts[type] = [];
        groupedAccounts[type].push(a);
    });

    // Compute running balance for transaction rows
    const txWithBalance = [];
    if (transactions.length > 0) {
        // We need to figure running balance. Since paged, we use total debit/credit before this page.
        // For simplicity, compute from transaction list (shown page only)
        let runBal = 0;
        for (const tx of [...transactions].reverse()) {
            runBal += (tx.debit || 0) - (tx.credit || 0);
            txWithBalance.unshift({ ...tx, runningBalance: runBal });
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse text-sm">Cari detayları yükleniyor...</div>;
    }

    if (!account) {
        return (
            <div className="p-8 text-center space-y-4">
                <h2 className="text-xl font-bold">Cari bulunamadı</h2>
                <Button asChild variant="outline">
                    <Link to="/finance/current-accounts"><ArrowLeft className="h-4 w-4 mr-2" />Carilere Dön</Link>
                </Button>
            </div>
        );
    }

    const totalDebit = account.totalDebit || 0;
    const totalCredit = account.totalCredit || 0;
    const balance = account.balance || (totalDebit - totalCredit);
    const isCredit = balance < 0;

    return (
        <div className="space-y-4 animate-in">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8">
                    <Link to="/finance/current-accounts"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight">{account.name}</h1>
                        <Badge variant="secondary" className="text-[10px]">{ACCOUNT_TYPE_LABELS[account.type] || account.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                        {account.contactName && <span>İlgili: {account.contactName}</span>}
                        {account.phone && <span>{account.phone}</span>}
                        {account.taxOffice && <span>VD: {account.taxOffice} / {account.taxNumber}</span>}
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1"><ArrowUpRight className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium">Toplam Borç</span></div>
                    <div className="text-2xl font-bold">{formatCurrency(totalDebit)}</div>
                </div>
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1"><ArrowDownRight className="h-4 w-4 text-orange-500" /><span className="text-sm font-medium">Toplam Alacak</span></div>
                    <div className="text-2xl font-bold">{formatCurrency(totalCredit)}</div>
                </div>
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1"><Scale className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Bakiye</span></div>
                    <div className={`text-2xl font-bold ${isCredit ? 'text-orange-600' : balance > 0 ? 'text-emerald-600' : ''}`}>
                        {formatCurrency(Math.abs(balance))} {isCredit ? '(Biz Borçluyuz)' : balance > 0 ? '(Biz Alacaklıyız)' : ''}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
                {/* Left Sidebar — Grouped Accounts */}
                <div className="lg:col-span-1 space-y-3">
                    {Object.entries(groupedAccounts).map(([type, accts]) => (
                        <Card key={type} className="glass-effect shadow-lg border-0">
                            <CardHeader className="py-2 px-3">
                                <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{ACCOUNT_TYPE_LABELS[type] || type}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {accts.map(a => {
                                    const bal = (a.totalDebit || 0) - (a.totalCredit || 0);
                                    return (
                                        <button
                                            key={a.id}
                                            onClick={() => navigate(`/finance/current-accounts/${a.id}`)}
                                            className={`w-full text-left px-3 py-2 text-xs border-t border-border/20 flex items-center justify-between transition-colors ${a.id === id ? 'bg-primary/5 text-primary font-semibold' : 'hover:bg-muted/5 text-foreground'}`}
                                        >
                                            <span className="truncate">{a.name}</span>
                                            <span className={`text-[10px] font-bold whitespace-nowrap ml-2 ${bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                                {formatCurrency(Math.abs(bal))}
                                            </span>
                                        </button>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Right — Transaction Table */}
                <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={() => setShowNewTx(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1" />Yeni İşlem
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}>
                            <Download className="h-3.5 w-3.5 mr-1" />Ekstre İndir
                        </Button>
                    </div>

                    <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                        {txLoading ? (
                            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div>
                        ) : txWithBalance.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                                <p className="text-sm">Henüz hesap hareketi bulunmuyor.</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/20 text-muted-foreground">
                                            <tr>
                                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tür</th>
                                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Açıklama</th>
                                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Belge No</th>
                                                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Borç (₺)</th>
                                                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Alacak (₺)</th>
                                                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Bakiye</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20">
                                            {txWithBalance.map((tx) => (
                                                <tr key={tx.id} className="hover:bg-muted/5">
                                                    <td className="py-2 px-4 text-xs whitespace-nowrap text-muted-foreground">
                                                        {tx.occurredAt ? format(new Date(tx.occurredAt), "dd MMM yyyy HH:mm", { locale: tr }) : "—"}
                                                    </td>
                                                    <td className="py-2 px-4">
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tx.transactionType === 'DEBIT' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-orange-500/10 text-orange-700'}`}>
                                                            {TX_TYPE_LABELS[tx.transactionType] || tx.transactionType}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-4 text-xs">{tx.description || "—"}</td>
                                                    <td className="py-2 px-4 text-xs text-muted-foreground">{tx.reference || "—"}</td>
                                                    <td className="py-2 px-4 text-right font-medium">
                                                        {tx.debit > 0 ? <span className="text-emerald-600">{formatCurrency(tx.debit)}</span> : "—"}
                                                    </td>
                                                    <td className="py-2 px-4 text-right font-medium">
                                                        {tx.credit > 0 ? <span className="text-orange-600">{formatCurrency(tx.credit)}</span> : "—"}
                                                    </td>
                                                    <td className={`py-2 px-4 text-right font-bold text-xs ${tx.runningBalance > 0 ? 'text-emerald-600' : tx.runningBalance < 0 ? 'text-orange-600' : ''}`}>
                                                        {formatCurrency(Math.abs(tx.runningBalance))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                        Toplam <span className="font-semibold text-foreground">{txPagination.total}</span> hareket
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={txPage <= 1} onClick={() => setTxPage(p => Math.max(1, p - 1))}>
                                            <ChevronLeft className="h-3.5 w-3.5 mr-1" />Önceki
                                        </Button>
                                        <span className="text-xs font-medium text-muted-foreground px-2">Sayfa {txPagination.page} / {txPagination.pages || 1}</span>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" disabled={txPage >= (txPagination.pages || 1)} onClick={() => setTxPage(p => Math.min(txPagination.pages || 1, p + 1))}>
                                            Sonraki<ChevronRight className="h-3.5 w-3.5 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Contact Info */}
                    {(account.phone || account.address || account.note) && (
                        <Card className="glass-effect shadow-lg border-0">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">İletişim Bilgileri</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                {account.phone && <div className="flex gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /><span>{account.phone}</span></div>}
                                {account.address && <div className="flex gap-2"><LocateFixed className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /><span>{account.address}</span></div>}
                                {account.note && <div className="flex gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /><span>{account.note}</span></div>}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* New Transaction Dialog */}
            <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Yeni İşlem — {account.name}</DialogTitle></DialogHeader>
                    <form onSubmit={handleNewTransaction} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>İşlem Türü *</Label>
                            <Select value={txForm.transactionType} onValueChange={v => setTxForm(f => ({ ...f, transactionType: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEBIT">Borç</SelectItem>
                                    <SelectItem value="CREDIT">Alacak</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tutar (kuruş) *</Label>
                            <Input type="number" min="1" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} required placeholder="10000 = 100 TL" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Açıklama</Label>
                            <Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="İşlem açıklaması" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Belge No / Referans</Label>
                            <Input value={txForm.reference} onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Ödeme Yöntemi</Label>
                            <Select value={txForm.paymentMethod || "__none__"} onValueChange={v => setTxForm(f => ({ ...f, paymentMethod: v === "__none__" ? "" : v }))}>
                                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    <SelectItem value="CASH">Nakit</SelectItem>
                                    <SelectItem value="CARD">Kredi Kartı</SelectItem>
                                    <SelectItem value="BANK_TRANSFER">Banka Transferi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowNewTx(false)}>İptal</Button>
                            <Button type="submit" className="btn-primary-gradient" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
