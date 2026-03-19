"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Download, Stethoscope, DollarSign, TrendingDown, BarChart3, CheckCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatCurrency } from "../../lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const STATUS_LABELS = { DRAFT: "Taslak", PROPOSED: "Önerildi", APPROVED: "Onaylandı", IN_PROGRESS: "Devam Ediyor", COMPLETED: "Tamamlandı", CANCELLED: "İptal" };
const PAGE_SIZE = 20;

export default function FinanceDebtorTreatmentsPage() {
    const navigate = useNavigate();
    const [treatments, setTreatments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [stats, setStats] = useState({ totalRemaining: 0, treatmentCount: 0, totalCost: 0, totalPaid: 0, totalPerformed: 0 });
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [page, setPage] = useState(1);
    const timer = useRef(null);

    const fetchData = useCallback(async (p) => {
        try {
            setLoading(true);
            const params = new URLSearchParams(); params.set("page", String(p)); params.set("limit", String(PAGE_SIZE));
            if (appliedSearch) params.set("search", appliedSearch);
            const res = await fetch(`/api/billing/debtor-treatments?${params}`); const data = await res.json();
            setTreatments(data.treatments || []); setPagination(data.pagination || { page: 1, pages: 1, total: 0 }); setStats(data.stats || { totalRemaining: 0, treatmentCount: 0, totalCost: 0, totalPaid: 0 });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [appliedSearch]);

    useEffect(() => { fetchData(page); }, [page, fetchData]);
    const onSearch = v => { setSearch(v); clearTimeout(timer.current); timer.current = setTimeout(() => { setAppliedSearch(v); setPage(1); }, 400); };

    const handleExport = async () => {
        const params = new URLSearchParams(); params.set("page", "1"); params.set("limit", "9999");
        if (appliedSearch) params.set("search", appliedSearch);
        const res = await fetch(`/api/billing/debtor-treatments?${params}`); const data = await res.json();
        const rows = (data.treatments || []).map(t => ({ "Tedavi Planı": t.title, Hasta: t.patientName, Hekim: t.doctorName || "-", Durum: STATUS_LABELS[t.status] || t.status, "Toplam": (t.totalCost / 100).toFixed(2), "Yapılan": (t.performedCost / 100).toFixed(2), "Ödenen": (t.totalPaid / 100).toFixed(2), "Kalan": (t.remaining / 100).toFixed(2), "İşlem Sayısı": `${t.completedItems}/${t.itemCount}` }));
        const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Borçlu Tedavi"); XLSX.writeFile(wb, `borclu_tedavi_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Borçlu Tedavi Listesi</h2><p className="text-xs text-muted-foreground mt-0.5">Ödenmemiş bakiyesi olan tedavi planları</p></div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Dışa Aktar</Button></div>

            <div className="grid gap-4 md:grid-cols-5">
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><TrendingDown className="h-4 w-4 text-red-500" /><span className="text-sm font-medium">Toplam Kalan</span></div><div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalRemaining)}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><BarChart3 className="h-4 w-4 text-blue-500" /><span className="text-sm font-medium">Toplam Maliyet</span></div><div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><CheckCircle className="h-4 w-4 text-cyan-500" /><span className="text-sm font-medium">Yapılan Tedavi</span></div><div className="text-2xl font-bold text-cyan-600">{formatCurrency(stats.totalPerformed)}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-sm font-medium">Toplam Ödenen</span></div><div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</div></div>
                <div className="glass-effect rounded-xl p-4 border border-border/50"><div className="flex items-center gap-2 text-muted-foreground mb-1"><Stethoscope className="h-4 w-4 text-purple-500" /><span className="text-sm font-medium">Tedavi Sayısı</span></div><div className="text-2xl font-bold">{stats.treatmentCount}</div></div>
            </div>

            <div className="glass-effect rounded-xl border border-border/50 px-4 py-3">
                <div className="relative max-w-sm"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input className="pl-8 h-8 text-xs" placeholder="Hasta veya tedavi ara..." value={search} onChange={e => onSearch(e.target.value)} /></div>
            </div>

            <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                {loading ? <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div> : treatments.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><p className="text-sm">Borçlu tedavi bulunamadı</p></div> : <>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/20 text-muted-foreground"><tr>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Tedavi Planı</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hasta</th>
                        <th className="py-2.5 px-4 text-left text-[11px] uppercase tracking-wide font-medium">Hekim</th>
                        <th className="py-2.5 px-4 text-center text-[11px] uppercase tracking-wide font-medium">Durum</th>
                        <th className="py-2.5 px-4 text-center text-[11px] uppercase tracking-wide font-medium">İşlem</th>
                        <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Toplam</th>
                        <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Yapılan</th>
                        <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Ödenen</th>
                        <th className="py-2.5 px-4 text-right text-[11px] uppercase tracking-wide font-medium">Kalan</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {treatments.map(t => <tr key={t.id} className="hover:bg-muted/5 cursor-pointer" onClick={() => navigate(`/patients/${t.patientId}?tab=payments`)}>
                                <td className="py-2.5 px-4 font-medium">{t.title}</td>
                                <td className="py-2.5 px-4">{t.patientName}</td>
                                <td className="py-2.5 px-4 text-muted-foreground">{t.doctorName || "—"}</td>
                                <td className="py-2.5 px-4 text-center"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">{STATUS_LABELS[t.status] || t.status}</span></td>
                                <td className="py-2.5 px-4 text-center text-muted-foreground">{t.completedItems}/{t.itemCount}</td>
                                <td className="py-2.5 px-4 text-right">{formatCurrency(t.totalCost)}</td>
                                <td className="py-2.5 px-4 text-right text-cyan-600">{formatCurrency(t.performedCost)}</td>
                                <td className="py-2.5 px-4 text-right text-emerald-600">{formatCurrency(t.totalPaid)}</td>
                                <td className="py-2.5 px-4 text-right font-bold text-red-600">{formatCurrency(t.remaining)}</td>
                            </tr>)}
                        </tbody></table></div>
                    <div className="px-4 py-3 border-t border-border/40 bg-muted/5 flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Toplam <span className="font-semibold text-foreground">{pagination.total}</span> tedavi</div>
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
