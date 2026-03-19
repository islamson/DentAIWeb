"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Download, Filter, X, DollarSign, TrendingUp, Users } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const METHOD_LABELS = { CASH: "Nakit", CARD: "Kredi Kartı", BANK_TRANSFER: "Banka Transferi", ONLINE: "Online", OTHER: "Diğer" };
const PAGE_SIZE = 20;

export default function FinancePatientIncomePage() {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [stats, setStats] = useState({ totalAmount: 0, count: 0 });
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ search: "", doctorId: "", method: "", dateFrom: "", dateTo: "" });
    const [applied, setApplied] = useState({ search: "", doctorId: "", method: "", dateFrom: "", dateTo: "" });
    const [page, setPage] = useState(1);
    const timer = useRef(null);

    useEffect(() => { fetch("/api/schedule/doctors").then(r => r.json()).then(d => setDoctors(d.doctors || [])).catch(() => { }); }, []);

    const fetchData = useCallback(async (p) => {
        try {
            setLoading(true);
            const params = new URLSearchParams(); params.set("page", String(p)); params.set("limit", String(PAGE_SIZE));
            if (applied.search) params.set("search", applied.search);
            if (applied.doctorId) params.set("doctorId", applied.doctorId);
            if (applied.method) params.set("method", applied.method);
            if (applied.dateFrom) params.set("dateFrom", applied.dateFrom);
            if (applied.dateTo) params.set("dateTo", applied.dateTo);
            const res = await fetch(`/api/billing/patient-income?${params}`);
            const data = await res.json();
            setPayments(data.payments || []); setPagination(data.pagination || { page: 1, pages: 1, total: 0 }); setStats(data.stats || { totalAmount: 0, count: 0 });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [applied]);

    useEffect(() => { fetchData(page); }, [page, fetchData]);

    const apply = () => { setApplied({ ...filters }); setPage(1); };
    const clear = () => { const e = { search: "", doctorId: "", method: "", dateFrom: "", dateTo: "" }; setFilters(e); setApplied(e); setPage(1); };
    const onSearch = v => { setFilters(f => ({ ...f, search: v })); clearTimeout(timer.current); timer.current = setTimeout(() => { setApplied(p => ({ ...p, search: v })); setPage(1); }, 400); };

    const handleExport = async () => {
        const params = new URLSearchParams(); params.set("page", "1"); params.set("limit", "9999");
        if (applied.search) params.set("search", applied.search); if (applied.doctorId) params.set("doctorId", applied.doctorId);
        if (applied.method) params.set("method", applied.method); if (applied.dateFrom) params.set("dateFrom", applied.dateFrom); if (applied.dateTo) params.set("dateTo", applied.dateTo);
        const res = await fetch(`/api/billing/patient-income?${params}`); const data = await res.json();
        const rows = (data.payments || []).map(p => ({ Tarih: p.paidAt ? format(new Date(p.paidAt), "dd.MM.yyyy HH:mm", { locale: tr }) : "-", Hasta: p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : "-", Hekim: p.doctor?.name || "-", "Ödeme Yöntemi": METHOD_LABELS[p.method] || p.method, Tutar: (p.amount / 100).toFixed(2), "KDV%": p.vatRate || 0, Referans: p.reference || "-", Not: p.notes || "-" }));
        const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Hasta Gelir"); XLSX.writeFile(wb, `hasta_gelir_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const hasFilters = applied.search || applied.doctorId || applied.method || applied.dateFrom || applied.dateTo;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Hasta Gelir Listesi</h2><p className="text-xs text-muted-foreground mt-0.5">Hastalardan alınan ödemelerin detaylı listesi</p></div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Dışa Aktar</Button></div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium">Toplam Tahsilat</span></div><div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalAmount)}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingUp className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Ödeme Sayısı</span></div><div className="text-2xl font-bold">{stats.count}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium">Ortalama Ödeme</span></div><div className="text-2xl font-bold">{formatCurrency(stats.count > 0 ? Math.round(stats.totalAmount / stats.count) : 0)}</div></div>
            </div>

            <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[200px] max-w-[320px]"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input className="pl-8 h-8 text-xs" placeholder="Hasta, referans ara..." value={filters.search} onChange={e => onSearch(e.target.value)} /></div>
                    <Select value={filters.doctorId || "__all__"} onValueChange={v => setFilters(f => ({ ...f, doctorId: v === "__all__" ? "" : v }))}><SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="Hekim" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tüm Hekimler</SelectItem>{doctors.map(d => <SelectItem key={d.user?.id} value={d.user?.id || ""}>{d.user?.name || "—"}</SelectItem>)}</SelectContent></Select>
                    <Select value={filters.method || "__all__"} onValueChange={v => setFilters(f => ({ ...f, method: v === "__all__" ? "" : v }))}><SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="Yöntem" /></SelectTrigger><SelectContent><SelectItem value="__all__">Tümü</SelectItem>{Object.entries(METHOD_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
                    <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
                    <Input type="date" className="h-8 text-xs w-[130px]" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
                    <Button size="sm" className="h-8 text-xs btn-primary-gradient" onClick={apply}><Filter className="h-3 w-3 mr-1" />Filtrele</Button>
                    {hasFilters && <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clear}><X className="h-3 w-3 mr-1" />Temizle</Button>}
                </div>
            </div>

            <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                {loading ? <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div> : payments.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><p className="text-sm">Gelir kaydı bulunamadı</p></div> : <>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/20 text-muted-foreground"><tr>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tarih</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hekim</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Yöntem</th>
                        <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Tutar</th>
                        <th className="py-2.5 px-4 text-center text-[11px] uppercase tracking-wide font-medium">KDV</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Referans</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {payments.map(p => <tr key={p.id} className="hover:bg-muted/5 cursor-pointer" onClick={() => p.patientId && navigate(`/patients/${p.patientId}?tab=payments`)}>
                                <td className="py-2.5 px-4 text-xs whitespace-nowrap">{p.paidAt ? format(new Date(p.paidAt), "dd MMM yyyy HH:mm", { locale: tr }) : "—"}</td>
                                <td className="py-2.5 px-4 font-medium">{p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : "—"}</td>
                                <td className="py-2.5 px-4 text-muted-foreground">{p.doctor?.name || "—"}</td>
                                <td className="py-2.5 px-4"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700">{METHOD_LABELS[p.method] || p.method}</span></td>
                                <td className="py-2.5 px-4 text-right font-semibold text-emerald-600">+{formatCurrency(p.amount)}</td>
                                <td className="py-2.5 px-4 text-center text-muted-foreground">{p.vatRate ? `%${p.vatRate}` : "—"}</td>
                                <td className="py-2.5 px-4 text-muted-foreground text-xs">{p.reference || "—"}</td>
                            </tr>)}
                        </tbody></table></div>
                    <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Toplam <span className="font-semibold text-foreground">{pagination.total}</span> kayıt</div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5 mr-1" />Önceki</Button>
                            <span className="text-xs font-medium text-muted-foreground px-2">Sayfa {pagination.page} / {pagination.pages || 1}</span>
                            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= (pagination.pages || 1)} onClick={() => setPage(p => Math.min(pagination.pages || 1, p + 1))}>Sonraki<ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
                        </div>
                    </div>
                </>}
            </div>
        </div>
    );
}
