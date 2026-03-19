"use client";
import { useState, useEffect } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Download, DollarSign, Users, Stethoscope, Receipt, ArrowLeftRight, CreditCard, Banknote, Landmark } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatCurrency } from "../../lib/utils";
import { format, addDays, subDays } from "date-fns";
import { tr } from "date-fns/locale";
import * as XLSX from "xlsx";

const METHOD_LABELS = { CASH: "Nakit", CARD: "Kredi Kartı", BANK_TRANSFER: "Banka Transferi", ONLINE: "Online", OTHER: "Diğer" };

export default function FinanceEndOfDayPage() {
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchData(); }, [date]);

    const fetchData = async () => {
        try { setLoading(true); const res = await fetch(`/api/billing/end-of-day?date=${date}`); const d = await res.json(); setData(d); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const prev = () => setDate(format(subDays(new Date(date), 1), "yyyy-MM-dd"));
    const next = () => setDate(format(addDays(new Date(date), 1), "yyyy-MM-dd"));
    const goToday = () => setDate(format(new Date(), "yyyy-MM-dd"));

    const handleExport = () => {
        if (!data) return;
        const wb = XLSX.utils.book_new();
        if (data.appointments?.length) { const ws = XLSX.utils.json_to_sheet(data.appointments.map(a => ({ Saat: a.startAt ? format(new Date(a.startAt), "HH:mm") : "-", Hasta: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : a.guestFirstName || "-", Hekim: a.doctor?.name || "-", Durum: a.status, Tür: a.appointmentType }))); XLSX.utils.book_append_sheet(wb, ws, "Randevular"); }
        if (data.payments?.length) { const ws = XLSX.utils.json_to_sheet(data.payments.map(p => ({ Saat: p.paidAt ? format(new Date(p.paidAt), "HH:mm") : "-", Hasta: p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : "-", Hekim: p.doctor?.name || "-", Tutar: (p.amount / 100).toFixed(2), Yöntem: METHOD_LABELS[p.method] || p.method, Tür: p.isRefund ? "İade" : "Ödeme" }))); XLSX.utils.book_append_sheet(wb, ws, "Ödemeler"); }
        if (data.treatments?.length) { const ws = XLSX.utils.json_to_sheet(data.treatments.map(t => ({ İşlem: t.name, Hasta: t.patientName || "-", Hekim: t.doctorName || "-", Tutar: ((t.price * t.quantity) / 100).toFixed(2) }))); XLSX.utils.book_append_sheet(wb, ws, "Tedaviler"); }
        XLSX.writeFile(wb, `gun_sonu_${date}.xlsx`);
    };

    const s = data?.stats || {};

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Gün Sonu</h2><p className="text-xs text-muted-foreground mt-0.5">Günlük aktivite ve finansal özet</p></div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExport}><Download className="h-3.5 w-3.5 mr-1.5" />Dışa Aktar</Button></div>

            <div className="glass-effect rounded-xl border border-border/50 px-4 py-3 flex items-center gap-3">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={prev}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                <Input type="date" className="h-8 text-xs w-[160px]" value={date} onChange={e => setDate(e.target.value)} />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={next}><ChevronRight className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>Bugün</Button>
                <span className="text-sm font-semibold ml-2">{format(new Date(date), "dd MMMM yyyy, EEEE", { locale: tr })}</span>
            </div>

            {loading ? <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Yükleniyor...</div> : !data ? <div className="p-8 text-center text-muted-foreground">Veri yüklenemedi</div> : <>

                <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><Users className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-medium text-muted-foreground">Randevu</span></div><div className="text-xl font-bold">{s.appointmentCount || 0}</div><p className="text-[10px] text-muted-foreground">{s.completedAppointments || 0} tamamlandı</p></div>
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /><span className="text-xs font-medium text-muted-foreground">Tahsilat</span></div><div className="text-xl font-bold text-emerald-600">{formatCurrency(s.totalCollected || 0)}</div><p className="text-[10px] text-muted-foreground">{s.paymentCount || 0} ödeme</p></div>
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><Banknote className="h-3.5 w-3.5 text-green-500" /><span className="text-xs font-medium text-muted-foreground">Nakit</span></div><div className="text-xl font-bold">{formatCurrency(s.cashPayments || 0)}</div></div>
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><CreditCard className="h-3.5 w-3.5 text-purple-500" /><span className="text-xs font-medium text-muted-foreground">Kredi Kartı</span></div><div className="text-xl font-bold">{formatCurrency(s.cardPayments || 0)}</div></div>
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><Landmark className="h-3.5 w-3.5 text-indigo-500" /><span className="text-xs font-medium text-muted-foreground">Banka</span></div><div className="text-xl font-bold">{formatCurrency(s.bankPayments || 0)}</div></div>
                    <div className="glass-effect rounded-xl p-3 border border-border/50"><div className="flex items-center gap-2 mb-1"><Stethoscope className="h-3.5 w-3.5 text-orange-500" /><span className="text-xs font-medium text-muted-foreground">Tedavi</span></div><div className="text-xl font-bold">{s.treatmentCount || 0}</div><p className="text-[10px] text-muted-foreground">{formatCurrency(s.treatmentTotal || 0)}</p></div>
                </div>

                {/* Randevular */}
                <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                    <div className="px-4 py-2.5 bg-muted/20 text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" />Randevular <span className="text-xs text-muted-foreground font-normal ml-auto">{data.appointments?.length || 0} kayıt</span></div>
                    {data.appointments?.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/10"><tr>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Saat</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hasta</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hekim</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Durum</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {data.appointments.map(a => <tr key={a.id} className="hover:bg-muted/5">
                                <td className="py-2 px-4 text-xs font-medium">{a.startAt ? format(new Date(a.startAt), "HH:mm") : "—"}</td>
                                <td className="py-2 px-4">{a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : a.guestFirstName || "—"}</td>
                                <td className="py-2 px-4 text-muted-foreground">{a.doctor?.name || "—"}</td>
                                <td className="py-2 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-700' : a.status === 'CANCELLED' ? 'bg-red-500/10 text-red-700' : 'bg-blue-500/10 text-blue-700'}`}>{a.status}</span></td>
                            </tr>)}
                        </tbody></table></div> : <div className="py-6 text-center text-muted-foreground text-sm">Bu gün randevu yok</div>}
                </div>

                {/* Ödemeler */}
                <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                    <div className="px-4 py-2.5 bg-muted/20 text-sm font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />Ödemeler <span className="text-xs text-muted-foreground font-normal ml-auto">{data.payments?.length || 0} kayıt — {formatCurrency(s.netCollected || 0)} net</span></div>
                    {data.payments?.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/10"><tr>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Saat</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hasta</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hekim</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Yöntem</th>
                        <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tutar</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {data.payments.map(p => <tr key={p.id} className="hover:bg-muted/5">
                                <td className="py-2 px-4 text-xs font-medium">{p.paidAt ? format(new Date(p.paidAt), "HH:mm") : "—"}</td>
                                <td className="py-2 px-4">{p.patient ? `${p.patient.firstName} ${p.patient.lastName}` : "—"}</td>
                                <td className="py-2 px-4 text-muted-foreground">{p.doctor?.name || "—"}</td>
                                <td className="py-2 px-4"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">{METHOD_LABELS[p.method] || p.method}</span></td>
                                <td className={`py-2 px-4 text-right font-semibold ${p.isRefund ? 'text-red-600' : 'text-emerald-600'}`}>{p.isRefund ? '-' : '+'}{formatCurrency(p.amount)}</td>
                            </tr>)}
                        </tbody></table></div> : <div className="py-6 text-center text-muted-foreground text-sm">Bu gün ödeme yok</div>}
                </div>

                {/* Tedaviler */}
                <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                    <div className="px-4 py-2.5 bg-muted/20 text-sm font-semibold flex items-center gap-2"><Stethoscope className="h-4 w-4 text-orange-500" />Tamamlanan Tedaviler <span className="text-xs text-muted-foreground font-normal ml-auto">{data.treatments?.length || 0} işlem — {formatCurrency(s.treatmentTotal || 0)}</span></div>
                    {data.treatments?.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/10"><tr>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">İşlem</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hasta</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hekim</th>
                        <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tutar</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {data.treatments.map(t => <tr key={t.id} className="hover:bg-muted/5">
                                <td className="py-2 px-4 font-medium">{t.name}</td>
                                <td className="py-2 px-4">{t.patientName || "—"}</td>
                                <td className="py-2 px-4 text-muted-foreground">{t.doctorName || "—"}</td>
                                <td className="py-2 px-4 text-right">{formatCurrency(t.price * t.quantity)}</td>
                            </tr>)}
                        </tbody></table></div> : <div className="py-6 text-center text-muted-foreground text-sm">Bu gün tamamlanan tedavi yok</div>}
                </div>

                {/* Faturalar */}
                <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                    <div className="px-4 py-2.5 bg-muted/20 text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4 text-indigo-500" />Faturalar <span className="text-xs text-muted-foreground font-normal ml-auto">{data.invoices?.length || 0} kayıt — {formatCurrency(s.invoiceTotal || 0)}</span></div>
                    {data.invoices?.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/10"><tr>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Fatura No</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Hasta</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Durum</th>
                        <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tutar</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {data.invoices.map(i => <tr key={i.id} className="hover:bg-muted/5">
                                <td className="py-2 px-4 font-medium">{i.number}</td>
                                <td className="py-2 px-4">{i.patient ? `${i.patient.firstName} ${i.patient.lastName}` : "—"}</td>
                                <td className="py-2 px-4"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${i.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>{i.status}</span></td>
                                <td className="py-2 px-4 text-right">{formatCurrency(i.netTotal)}</td>
                            </tr>)}
                        </tbody></table></div> : <div className="py-6 text-center text-muted-foreground text-sm">Bu gün fatura yok</div>}
                </div>

                {/* Finansal Hareketler */}
                <div className="glass-effect rounded-xl overflow-hidden border border-border/50">
                    <div className="px-4 py-2.5 bg-muted/20 text-sm font-semibold flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-cyan-500" />Muhasebe Hareketleri <span className="text-xs text-muted-foreground font-normal ml-auto">{data.movements?.length || 0} kayıt</span></div>
                    {data.movements?.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/10"><tr>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Saat</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tür</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Açıklama</th>
                        <th className="py-2 px-4 text-left text-[11px] uppercase tracking-wide font-medium text-muted-foreground">İlgili</th>
                        <th className="py-2 px-4 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Tutar</th>
                    </tr></thead><tbody className="divide-y divide-border/20">
                            {data.movements.map(m => <tr key={m.id} className="hover:bg-muted/5">
                                <td className="py-2 px-4 text-xs">{m.occurredAt ? format(new Date(m.occurredAt), "HH:mm") : "—"}</td>
                                <td className="py-2 px-4"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-700">{m.type}</span></td>
                                <td className="py-2 px-4 text-muted-foreground text-xs">{m.description || "—"}</td>
                                <td className="py-2 px-4 text-xs">{m.patient ? `${m.patient.firstName} ${m.patient.lastName}` : m.currentAccount?.name || "—"}</td>
                                <td className={`py-2 px-4 text-right font-semibold ${m.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.amount >= 0 ? '+' : ''}{formatCurrency(m.amount)}</td>
                            </tr>)}
                        </tbody></table></div> : <div className="py-6 text-center text-muted-foreground text-sm">Bu gün hareket yok</div>}
                </div>
            </>}
        </div>
    );
}
