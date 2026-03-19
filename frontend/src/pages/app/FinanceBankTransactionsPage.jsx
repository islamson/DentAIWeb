"use client";
import { useState, useEffect, useCallback } from "react";
import { Landmark, Plus, ChevronLeft, ChevronRight, Download, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const PAGE_SIZE = 20;

export default function FinanceBankTransactionsPage() {
    const [accounts, setAccounts] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [movements, setMovements] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [stats, setStats] = useState({ totalAmount: 0 });
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ dateFrom: "", dateTo: "" });
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", type: "BANK", bankName: "", iban: "" });

    useEffect(() => { fetchAccounts(); }, []);

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/bank-accounts"); const data = await res.json(); setAccounts(data.accounts || []);
            if (data.accounts?.length > 0 && !selectedId) setSelectedId(data.accounts[0].id);
        } catch (e) { console.error(e); }
    };

    const fetchMovements = useCallback(async () => {
        if (!selectedId) return;
        try {
            setLoading(true);
            const params = new URLSearchParams(); params.set("page", String(page)); params.set("limit", String(PAGE_SIZE));
            if (filters.dateFrom) params.set("dateFrom", filters.dateFrom); if (filters.dateTo) params.set("dateTo", filters.dateTo);
            const res = await fetch(`/api/bank-accounts/${selectedId}/transactions?${params}`); const data = await res.json();
            setMovements(data.movements || []); setPagination(data.pagination || { page: 1, pages: 1, total: 0 }); setStats(data.stats || { totalAmount: 0 });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [selectedId, page, filters]);

    useEffect(() => { fetchMovements(); }, [fetchMovements]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/bank-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
            if (res.ok) { setShowCreate(false); setCreateForm({ name: "", type: "BANK", bankName: "", iban: "" }); fetchAccounts(); }
        } catch (e) { console.error(e); }
    };

    const selectedAccount = accounts.find(a => a.id === selectedId);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Banka İşlemleri</h2><p className="text-xs text-muted-foreground mt-0.5">Banka ve kasa hesap hareketleri</p></div>
                <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={() => setShowCreate(true)}><Plus className="h-3.5 w-3.5 mr-1" />Yeni Hesap</Button></div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Landmark className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Hesap Sayısı</span></div><div className="text-2xl font-bold">{accounts.length}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium">Seçili Hesap Bakiye</span></div><div className="text-2xl font-bold">{selectedAccount ? formatCurrency(selectedAccount.currentBalance) : "—"}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><ArrowUpRight className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium">İşlem Toplamı</span></div><div className="text-2xl font-bold">{formatCurrency(Math.abs(stats.totalAmount))}</div></div>
            </div>

            <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <Select value={selectedId || ""} onValueChange={v => { setSelectedId(v); setPage(1); }}><SelectTrigger className="h-8 text-xs w-[250px]"><SelectValue placeholder="Hesap seçin" /></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type === "BANK" ? "Banka" : "Kasa"})</SelectItem>)}</SelectContent></Select>
                    <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                    <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
                </div>
            </div>

            <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                {!selectedId ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><Landmark className="h-8 w-8 opacity-30" /><p className="text-sm">Lütfen bir hesap seçin veya oluşturun</p></div> :
                    loading ? <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div> : movements.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><p className="text-sm">Bu hesaba ait hareket bulunamadı</p></div> : <>
                        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/20 text-muted-foreground"><tr>
                            <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                            <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tür</th>
                            <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Açıklama</th>
                            <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">İlgili</th>
                            <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Tutar</th>
                        </tr></thead><tbody className="divide-y divide-border/20">
                                {movements.map(m => <tr key={m.id} className="hover:bg-muted/5">
                                    <td className="py-2.5 px-4 text-xs whitespace-nowrap">{m.occurredAt ? format(new Date(m.occurredAt), "dd MMM yyyy HH:mm", { locale: tr }) : "—"}</td>
                                    <td className="py-2.5 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.amount >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}`}>{m.type}</span></td>
                                    <td className="py-2.5 px-4 text-muted-foreground">{m.description || "—"}</td>
                                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{m.patient ? `${m.patient.firstName} ${m.patient.lastName}` : m.currentAccount?.name || "—"}</td>
                                    <td className={`py-2.5 px-4 text-right font-semibold ${m.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.amount >= 0 ? '+' : ''}{formatCurrency(m.amount)}</td>
                                </tr>)}
                            </tbody></table></div>
                        <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">Toplam <span className="font-semibold text-foreground">{pagination.total}</span> hareket</div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Önceki</Button>
                                <span className="text-xs font-medium text-muted-foreground px-2">Sayfa {pagination.page} / {pagination.pages || 1}</span>
                                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= (pagination.pages || 1)} onClick={() => setPage(p => Math.min(pagination.pages || 1, p + 1))}>Sonraki<ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
                            </div>
                        </div>
                    </>}
            </div>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Yeni Hesap Oluştur</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <div className="space-y-1.5"><Label>Hesap Adı *</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required /></div>
                        <div className="space-y-1.5"><Label>Tür</Label><Select value={createForm.type} onValueChange={v => setCreateForm(f => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BANK">Banka</SelectItem><SelectItem value="CASH">Kasa</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1.5"><Label>Banka Adı</Label><Input value={createForm.bankName} onChange={e => setCreateForm(f => ({ ...f, bankName: e.target.value }))} /></div>
                        <div className="space-y-1.5"><Label>IBAN</Label><Input value={createForm.iban} onChange={e => setCreateForm(f => ({ ...f, iban: e.target.value }))} /></div>
                        <DialogFooter><Button type="button" variant="outline" onClick={() => setShowCreate(false)}>İptal</Button><Button type="submit" className="btn-primary-gradient">Oluştur</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
