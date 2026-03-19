"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../lib/utils";
import {
    Building2,
    Plus,
    Search,
    MoreVertical,
    Pencil,
    Trash2,
    Eye,
    BookOpen,
    ArrowUpRight,
    ArrowDownRight,
    Scale,
    X,
} from "lucide-react";

import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

const ACCOUNT_TYPE_LABELS = {
    SUPPLIER: "Tedarikçi",
    LAB: "Laboratuvar",
    EXTERNAL_INSTITUTION: "Kurum",
    VENDOR: "Satıcı",
    DOCTOR: "Hekim",
    PERSONNEL: "Personel",
    HEALTH_AGENCY: "Sağlık Acentesi",
    OPERATING_EXPENSE: "İşletme Gideri",
    MEDICAL: "Medikal",
    BANK: "Banka",
    CASH: "Kasa",
    OTHER: "Diğer",
};

const ACCOUNT_TYPE_COLORS = {
    SUPPLIER: "bg-blue-100 text-blue-700",
    LAB: "bg-purple-100 text-purple-700",
    EXTERNAL_INSTITUTION: "bg-cyan-100 text-cyan-700",
    VENDOR: "bg-amber-100 text-amber-700",
    DOCTOR: "bg-emerald-100 text-emerald-700",
    PERSONNEL: "bg-pink-100 text-pink-700",
    HEALTH_AGENCY: "bg-rose-100 text-rose-700",
    OPERATING_EXPENSE: "bg-red-100 text-red-700",
    MEDICAL: "bg-indigo-100 text-indigo-700",
    BANK: "bg-sky-100 text-sky-700",
    CASH: "bg-teal-100 text-teal-700",
    OTHER: "bg-gray-100 text-gray-700",
};

const EMPTY_FORM = { name: "", type: "SUPPLIER", contactName: "", phone: "", taxOffice: "", taxNumber: "", address: "", note: "" };

export default function FinanceCariPage() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const timer = useRef(null);

    useEffect(() => {
        fetchAccounts();
    }, [search]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/current-accounts?search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error("Failed to fetch current accounts");
            const data = await res.json();
            setAccounts(data.accounts || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateBalance = (account) => {
        return (account.totalDebit || 0) - (account.totalCredit || 0);
    };

    const summary = accounts.reduce((acc, account) => {
        acc.totalDebit += account.totalDebit || 0;
        acc.totalCredit += account.totalCredit || 0;
        acc.balance += (account.totalDebit || 0) - (account.totalCredit || 0);
        return acc;
    }, { totalDebit: 0, totalCredit: 0, balance: 0 });

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const body = { ...form };
            // Strip empty optional fields
            Object.keys(body).forEach(k => { if (!body[k]) delete body[k]; });
            if (!body.name) return;
            const res = await fetch("/api/current-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                alert(err.error || "Cari oluşturulamadı");
                return;
            }
            setShowCreate(false);
            setForm({ ...EMPTY_FORM });
            fetchAccounts();
        } catch (err) {
            console.error(err);
            alert("Cari oluşturulurken hata oluştu");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Bu cari hesabı silmek istediğinize emin misiniz?")) return;
        try {
            const res = await fetch(`/api/current-accounts/${id}`, { method: "DELETE" });
            if (res.ok) fetchAccounts();
            else alert("Silme işlemi başarısız");
        } catch (err) {
            console.error(err);
        }
    };

    const onSearch = (v) => {
        setSearch(v);
    };

    return (
        <div className="space-y-4 animate-in">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cari Takibi</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Tedarikçi, laboratuvar, kurum ve diğer cariler</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="btn-primary-gradient" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Yeni Cari Ekle
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium">Toplam Borç</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalDebit)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">{accounts.length} hesap</p>
                </div>
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <ArrowDownRight className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Toplam Alacak</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalCredit)}</div>
                </div>
                <div className="glass-effect rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Scale className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">Bakiye</span>
                    </div>
                    <div className={`text-2xl font-bold ${summary.balance > 0 ? 'text-emerald-600' : summary.balance < 0 ? 'text-orange-600' : ''}`}>
                        {formatCurrency(Math.abs(summary.balance))}
                        {summary.balance > 0 ? ' (B)' : summary.balance < 0 ? ' (A)' : ''}
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
                <div className="relative max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Cari adı, tipi veya kişi ara..."
                        className="pl-8 h-8 text-xs"
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/20 text-muted-foreground">
                            <tr>
                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Cari Adı</th>
                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tip</th>
                                <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">İletişim</th>
                                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Bakiye</th>
                                <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium w-[80px]">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Cariler yükleniyor...</td></tr>
                            ) : accounts.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Cari hesabı bulunamadı.</td></tr>
                            ) : (
                                accounts.map((account) => {
                                    const balance = calculateBalance(account);
                                    const isCredit = balance < 0;
                                    return (
                                        <tr key={account.id} className="hover:bg-muted/5">
                                            <td className="py-2.5 px-4">
                                                <Link to={`/finance/current-accounts/${account.id}`} className="font-semibold text-primary hover:underline flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    {account.name}
                                                </Link>
                                                {account.contactName && (
                                                    <div className="text-xs text-muted-foreground mt-0.5 pl-6">İlgili: {account.contactName}</div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-4">
                                                <Badge variant="secondary" className={`${ACCOUNT_TYPE_COLORS[account.type] || ACCOUNT_TYPE_COLORS.OTHER} text-[10px]`}>
                                                    {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                                                </Badge>
                                            </td>
                                            <td className="py-2.5 px-4 text-muted-foreground text-xs">
                                                {account.phone && <div>{account.phone}</div>}
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <span className={`font-bold ${isCredit ? 'text-orange-600' : balance > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                    {formatCurrency(Math.abs(balance))} {isCredit ? '(A)' : balance > 0 ? '(B)' : ''}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link to={`/finance/current-accounts/${account.id}`}>
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                Detay
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem asChild>
                                                            <Link to={`/finance/current-accounts/${account.id}`}>
                                                                <BookOpen className="h-4 w-4 mr-2" />
                                                                Muhasebe
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(account.id)}>
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Sil
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && accounts.length > 0 && (
                    <div className="px-4 py-3 border-t border-border/40 bg-muted/5 text-xs text-muted-foreground">
                        Toplam <span className="font-semibold text-foreground">{accounts.length}</span> cari hesap
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Yeni Cari Ekle</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5 col-span-2">
                                <Label>Cari Adı *</Label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Kurum / kişi adı" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tip *</Label>
                                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, l]) => (
                                            <SelectItem key={k} value={k}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>İlgili Kişi</Label>
                                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Ad Soyad" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Telefon</Label>
                                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0532..." />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Vergi Dairesi</Label>
                                <Input value={form.taxOffice} onChange={e => setForm(f => ({ ...f, taxOffice: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Vergi No</Label>
                                <Input value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <Label>Adres</Label>
                                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Açık adres" />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <Label>Not</Label>
                                <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ek notlar" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
                            <Button type="submit" className="btn-primary-gradient" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
